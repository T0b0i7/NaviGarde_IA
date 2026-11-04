import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

/**
 * Observabilité minimale, sans dépendance externe.
 *
 * - Compteurs en mémoire par route et par statut HTTP.
 * - Chronométrage des requêtes lentes.
 * - Log structuré (pino) de toute erreur HTTP >= 500 avec la route, la durée
 *   et l'identifiant de requête. Aucun corps de requête n'est journalisé :
 *   il peut contenir des identifiants.
 *
 * Les compteurs sont volontairement en mémoire : suffisant pour un processus.
 * Pour plusieurs instances, brancher un export Prometheus et un stockage
 * partagé (voir la note en fin de fichier).
 */

type RouteStats = { count: number; errors: number; totalMs: number; maxMs: number };

const routeStats = new Map<string, RouteStats>();
const statusCounters = new Map<number, number>();
const startedAt = Date.now();
let requestCounter = 0;

/** Route normalisée : évite une carte qui grossit avec chaque identifiant. */
export function normalizeRoute(req: Request): string {
  const path = (req.baseUrl ?? "") + (req.route?.path ?? req.path ?? "");
  return (path || "unknown")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(/\/api\/trpc\/[^/?]+/g, "/api/trpc/*")
    .slice(0, 160);
}

function record(route: string, statusCode: number, durationMs: number) {
  const key = `${route} ${statusCode >= 500 ? "error" : statusCode >= 400 ? "client" : "ok"}`;
  const stats = routeStats.get(key) ?? { count: 0, errors: 0, totalMs: 0, maxMs: 0 };
  stats.count += 1;
  stats.totalMs += durationMs;
  stats.maxMs = Math.max(stats.maxMs, durationMs);
  if (statusCode >= 500) stats.errors += 1;
  routeStats.set(key, stats);

  const statusBand = Math.floor(statusCode / 100) * 100;
  statusCounters.set(statusBand, (statusCounters.get(statusBand) ?? 0) + 1);
}

export function metricsMiddleware() {
  const slowMs = Number(process.env.SLOW_REQUEST_MS || 1500);

  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    const requestId = `${process.pid}-${++requestCounter}`;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const route = normalizeRoute(req);
      record(route, res.statusCode, durationMs);

      if (res.statusCode >= 500) {
        logger.error(
          { requestId, method: req.method, route, status: res.statusCode, durationMs: Math.round(durationMs) },
          "HTTP error response",
        );
      } else if (durationMs >= slowMs) {
        logger.warn(
          { requestId, method: req.method, route, status: res.statusCode, durationMs: Math.round(durationMs) },
          "Slow request",
        );
      }
    });

    next();
  };
}

export type MetricsSnapshot = {
  uptimeSeconds: number;
  startedAt: string;
  statusCodes: Record<string, number>;
  routes: Array<{ route: string; count: number; errors: number; avgMs: number; maxMs: number }>;
  memory: { rssMb: number; heapUsedMb: number };
};

export function snapshotMetrics(): MetricsSnapshot {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    startedAt: new Date(startedAt).toISOString(),
    statusCodes: Object.fromEntries([...statusCounters.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [`${k}xx`, v])),
    routes: [...routeStats.entries()]
      .map(([key, stats]) => {
        const [route, kind] = key.split(" ");
        return {
          route: `${route} [${kind}]`,
          count: stats.count,
          errors: stats.errors,
          avgMs: Math.round(stats.totalMs / stats.count),
          maxMs: Math.round(stats.maxMs),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 50),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
    },
  };
}

// Note multi-instance : exporter `snapshotMetrics` vers un endpoint Prometheus
// et remplacer les Map par un collecteur partagé si plusieurs réplicas tournent.
