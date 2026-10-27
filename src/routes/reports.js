/**
 * Routes du module Rapport (EF-30 à EF-37).
 * Référence métier : /api/v1/generate-report puis /api/v1/reports/:id.
 */

import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { requireRole } from '../middleware/auth.js';
import {
  editDraft,
  exportReportPdf,
  generateReportFor,
  readReport,
  validate,
} from '../services/reportService.js';

export const reportsRouter = Router();

const generateSchema = z.object({
  inspection_id: z.string().uuid("Identifiant d'inspection invalide (UUID attendu)"),
  alert_id: z.string().uuid("Identifiant d'alerte invalide (UUID attendu)").nullish(),
  type: z.enum(['infraction', 'inspection', 'incident']).optional(),
});

const editSchema = z.object({
  content: z.string().trim().min(20, 'Le rapport doit contenir au moins 20 caractères').max(50_000),
});

/** POST /api/v1/generate-report — inspection (+ alerte facultative) → rapport. */
reportsRouter.post('/generate-report', requireRole('agent', 'supervisor'), async (req, res, next) => {
  try {
    const parsed = generateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Demande de rapport invalide.', {
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await generateReportFor({
      inspectionId: parsed.data.inspection_id,
      alertId: parsed.data.alert_id ?? null,
      type: parsed.data.type ?? 'inspection',
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});

/** GET /api/v1/reports/:id/download — export PDF réglementaire (EF-34). */
reportsRouter.get(
  '/reports/:id/download',
  requireRole('agent', 'supervisor', 'admin'),
  async (req, res, next) => {
    try {
      const { buffer, filename, hash } = await exportReportPdf(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('X-Report-SHA256', String(hash ?? ''));
      return res.end(buffer);
    } catch (error) {
      return next(error);
    }
  },
);

/** GET /api/v1/reports/:id — relecture + contrôle d'intégrité du hash. */
reportsRouter.get('/reports/:id', requireRole('agent', 'supervisor', 'admin'), async (req, res, next) => {
  try {
    return res.json(await readReport(req.params.id));
  } catch (error) {
    return next(error);
  }
});

/** PATCH /api/v1/reports/:id — brouillon uniquement. */
reportsRouter.patch('/reports/:id', requireRole('agent', 'supervisor'), async (req, res, next) => {
  try {
    const parsed = editSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Contenu de rapport invalide.', {
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await editDraft(req.params.id, parsed.data.content);
    return res.status(result.meta?.versioned ? 201 : 200).json(result);
  } catch (error) {
    return next(error);
  }
});

/** POST /api/v1/reports/:id/validate — superviseur : verrouille le rapport. */
reportsRouter.post('/reports/:id/validate', requireRole('supervisor'), async (req, res, next) => {
  try {
    const validatedBy = req.get('x-validated-by') ?? req.user?.role ?? 'superviseur';
    return res.json(await validate(req.params.id, validatedBy.slice(0, 120)));
  } catch (error) {
    return next(error);
  }
});
