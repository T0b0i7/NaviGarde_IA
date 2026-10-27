/**
 * Route publique d'alerte vocale (EF-20 à EF-28), consommée par la page marin.
 * Pas de compte : jeton d'alerte optionnel + limite de débit par terminal.
 */

import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { audioUpload, receive, sniffAudioType } from '../middleware/upload.js';
import { processVoiceAlert } from '../services/alertService.js';

export const audioRouter = Router();

const LIMIT = Number(process.env.ALERT_RATE_LIMIT ?? 10);
const WINDOW_MS = Number(process.env.ALERT_RATE_WINDOW_MS ?? 600_000);
const hits = new Map();

/** Limite de débit en mémoire : 10 alertes / 10 min par défaut. */
function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip ?? 'inconnu';
  const entry = hits.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  hits.set(key, entry);

  res.setHeader('x-ratelimit-remaining', Math.max(0, LIMIT - entry.count));
  if (entry.count > LIMIT) {
    return next(
      new HttpError(429, 'RATE_LIMITED', 'Trop d\'alertes envoyées depuis ce terminal. Réessayez plus tard.'),
    );
  }
  return next();
}

/** Jeton d'alerte facultatif : activé dès que `ALERT_TOKEN` est défini. */
function alertToken(req, res, next) {
  const expected = process.env.ALERT_TOKEN;
  if (!expected) return next();
  if (req.get('x-alert-token') !== expected) {
    return next(new HttpError(401, 'INVALID_ALERT_TOKEN', "Jeton d'alerte absent ou invalide."));
  }
  return next();
}

/** Position facultative : jamais déduite, jamais inventée (règle de sécurité). */
const positionSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * POST /api/v1/voice-alert
 * multipart/form-data : audio (15 Mo max) + latitude/longitude facultatifs.
 */
audioRouter.post('/voice-alert', rateLimit, alertToken, async (req, res, next) => {
  try {
    await receive(req, res, audioUpload);

    if (!req.file?.buffer?.length) {
      throw new HttpError(400, 'MISSING_AUDIO', 'Aucun audio reçu : le champ « audio » est requis.');
    }

    const mimeType = sniffAudioType(req.file.buffer);
    if (!mimeType) {
      throw new HttpError(
        415,
        'INVALID_AUDIO_CONTENT',
        "Le fichier reçu n'est pas un audio lisible (WAV, MP3, M4A, OGG, WEBM, FLAC).",
      );
    }

    const parsed = positionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Position invalide.', {
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await processVoiceAlert({
      buffer: req.file.buffer,
      mimeType,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});
