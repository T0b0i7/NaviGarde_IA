import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStorageProxy } from "./storageProxy";
import { logger } from "./logger";
import { authenticateLocalRequest } from "./localAuth";
import { assertEnvironment } from "./envValidation";
import { metricsMiddleware, snapshotMetrics } from "./metrics";
import { registerUploadRoutes } from "../uploadRoutes";
import { ensureCsrfToken } from "./csrf";
import { checkDatabase } from "../db";
import { isStorageDurable, storageDriver } from "../storage";
import { renderReportPdf } from "../reportPdf";
import { getInspection, getReport } from "../db";

async function startServer() {
  // Refuse de démarrer sur une configuration incohérente (superutilisateur DB,
  // secret absent ou trop court). En développement, seuls des avertissements
  // sont produits.
  const envReport = assertEnvironment();
  for (const issue of envReport.issues) {
    const payload = { variable: issue.variable, severity: issue.severity, message: issue.message };
    if (issue.severity === "error") logger.error(payload, "Configuration");
    else logger.warn(payload, "Configuration");
  }
  logger.info(envReport.summary, "Environment validated");

  // Le stockage disque perd les photos et PDF à chaque redéploiement : en
  // production c'est une erreur, en développement c'est un avertissement.
  if (!isStorageDurable()) {
    const payload = {
      driver: storageDriver(),
      severity: process.env.NODE_ENV === "production" ? "error" : "warning",
      message: "Stockage non durable : les fichiers seront perdus au redéploiement. Définissez STORAGE_DRIVER=mysql.",
    };
    if (process.env.NODE_ENV === "production") throw new Error(payload.message);
    logger.warn(payload, "Storage");
  } else {
    logger.info({ driver: storageDriver() }, "Storage durable (MySQL)");
  }

  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(metricsMiddleware());

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "blob:", "data:"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    // Jeton CSRF : posé sur chaque réponse pour que la première page venue
    // d'un visiteur authentifié dispose déjà du jeton avant sa première
    // mutation.
    ensureCsrfToken(req, res);
    next();
  });
  // Global rate limiter
  // Naviguer dans l'application déclenche beaucoup d'appels tRPC (dashboard,
  // notifications, alertes toutes les 30 s). Un plafond de 300 requêtes par
  // 15 minutes coupait l'accès à la navigation normale et faussait les tests
  // navigateur. On limite par seconde et par minute : plus haut en volume,
  // mais toujours incapable de saturer le serveur.
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_PER_MINUTE || 600),
    standardHeaders: true,
    legacyHeaders: false,
    // La santé et les fichiers ne pèsent pas sur le quota d'API. En test, la
    // limitation est désactivée : un parcours navigateur enchaîne les rôles
    // depuis la même IP et ne doit pas être freiné par un quota pensé pour
    // le trafic réel.
    skip: (req) => process.env.NODE_ENV === "test" || req.path.startsWith("/api/health") || req.path.startsWith("/uploads/"),
  });
  app.use(globalLimiter);
  const pdfLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Trop de generations de PDF, reessayez dans quelques minutes" },
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));
  app.get("/api/health", async (_req, res) => {    const db = await checkDatabase();
    const healthy = db.ok;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      database: db,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
  // Métriques protégées par jeton : jamais exposées publiquement.
  app.get("/api/metrics", (req, res) => {
    const token = process.env.METRICS_TOKEN?.trim();
    const provided = String(req.headers["x-metrics-token"] ?? "");
    // Sans jeton configuré, l'endpoint reste ouvert en développement seulement.
    const allowed = token ? provided === token : process.env.NODE_ENV !== "production";
    if (!allowed) {
      res.status(401).json({ error: "Jeton de métriques invalide" });
      return;
    }
    res.json(snapshotMetrics());
  });

  // Fichiers servis depuis MySQL (photos d'inspection, PDF archivés).
  // Remplace `express.static(uploadsDir)` : le disque du conteneur n'est pas
  // durable, la base l'est.
  registerUploadRoutes(app);
  app.get("/api/reports/:id/pdf", pdfLimiter, async (req, res) => {
    try {
      const user = await authenticateLocalRequest(req);
      if (!user) {
        res.status(401).json({ error: "Authentification requise" });
        return;
      }
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Identifiant invalide" });
        return;
      }
      const report = await getReport(id);
      if (!report) {
        res.status(404).json({ error: "Rapport introuvable" });
        return;
      }
      const inspection = report.inspectionId ? await getInspection(report.inspectionId) : undefined;
      const privileged = ["admin", "supervisor"].includes(String(user.appRole));
      if (!privileged && inspection?.agentId !== user.id) {
        res.status(403).json({ error: "Acces a ce rapport refuse" });
        return;
      }
      const pdf = await renderReportPdf(id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="rapport-${id}.pdf"`);
      res.setHeader("Cache-Control", "no-store");
      res.send(pdf);
    } catch (error) {
      logger.error({ err: error }, "Report PDF generation failed");
      res.status(500).json({ error: "Generation PDF impossible" });
    }
  });
  registerStorageProxy(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { logger.error({ err: error }, "Server failed"); process.exit(1); });
  server.listen(port, "0.0.0.0", () => logger.info({ port }, "Server listening"));

  // Arrêt propre : laisse les requêtes en cours se terminer avant de couper.
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutdown requested");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Aucune erreur non capturée ne doit laisser un processus zombie sans trace.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception, exiting");
  process.exit(1);
});

startServer().catch(error => { logger.error({ err: error }, "Failed to start server"); process.exit(1); });
