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
import { uploadsDir } from "../storage";
import { renderReportPdf } from "../reportPdf";
import { getInspection, getReport } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
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
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    next();
  });
  // Global rate limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
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
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use(
    "/uploads",
    express.static(uploadsDir(), {
      maxAge: "7d",
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      },
    })
  );
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
}

startServer().catch(error => { logger.error({ err: error }, "Failed to start server"); process.exit(1); });
