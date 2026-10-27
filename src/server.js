/**
 * NaviGarde IA — point d'entrée de l'API.
 * Toute requête passe par Express avant d'atteindre un modèle (section 7.1).
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { ZodError } from 'zod';
import { closePool, getDbStatus, ping } from './config/db.js';
import { HttpError } from './lib/httpError.js';
import { audioRouter } from './routes/audio.js';
import { inspectRouter } from './routes/inspect.js';
import { reportsRouter } from './routes/reports.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* -------------------------------------------------------------------------- */
/* Santé                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/v1/health
 * Réponse immédiate par défaut (état mis en cache, aucune I/O).
 * `?db=1` force une vérification réelle de la connexion PostgreSQL.
 */
app.get('/api/v1/health', async (req, res) => {
  if (req.query.db === '1') await ping();

  const database = getDbStatus();
  res.json({
    status: 'success',
    service: 'navigarde-ia',
    version: process.env.npm_package_version ?? '0.2.0',
    ai_provider: process.env.AI_PROVIDER ?? 'mock',
    database,
    // `degraded` : la persistance est attendue mais la base est hors service.
    state: database.enabled && database.status === 'unavailable' ? 'degraded' : 'ok',
    uptime_s: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* -------------------------------------------------------------------------- */
/* Routes métier                                                              */
/* -------------------------------------------------------------------------- */

app.use('/api/v1', inspectRouter);
app.use('/api/v1', audioRouter);
app.use('/api/v1', reportsRouter);

/* -------------------------------------------------------------------------- */
/* 404                                                                        */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route inconnue : ${req.method} ${req.originalUrl}`,
  });
});

/* -------------------------------------------------------------------------- */
/* Gestionnaire d'erreurs uniforme                                            */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line no-unused-vars -- Express identifie le gestionnaire par son arité.
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err instanceof multer.MulterError) {
    const isTooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(isTooLarge ? 413 : 400).json({
      status: 'error',
      code: isTooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      message: isTooLarge
        ? `Fichier trop volumineux : ${process.env.MAX_IMAGE_MB ?? 10} Mo maximum.`
        : `Téléversement refusé : ${err.message}`,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_INPUT',
      message: 'Données invalides.',
      details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }

  console.error('[navigarde] erreur non gérée :', err);
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Erreur interne. Consultez les journaux du serveur.',
  });
});

const server = app.listen(PORT, () => {
  console.log(`[navigarde] API prête sur http://localhost:${PORT}/api/v1/health`);
  console.log(`[navigarde] Fournisseur IA : ${process.env.AI_PROVIDER ?? 'mock'}`);
  const database = getDbStatus();
  console.log(
    `[navigarde] Persistance : ${database.enabled ? `postgres (${database.status})` : 'désactivée'}`,
  );
});

/** Arrêt propre : on ferme le pool pour ne pas laisser de connexions ouvertes. */
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[navigarde] ${signal} reçu, arrêt en cours…`);
    server.close(() => closePool().finally(() => process.exit(0)));
  });
}

export { app };
