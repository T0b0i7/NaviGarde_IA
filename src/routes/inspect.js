import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { requireRole } from '../middleware/auth.js';
import { receiveImage, sniffImageType } from '../middleware/upload.js';
import { runInspection } from '../services/inspectionService.js';

export const inspectRouter = Router();

/** Métadonnées minimales d'une inspection (EF-10). */
const inspectionMetadataSchema = z.object({
  vessel_name: z.string().trim().min(1, "Le nom ou l'immatriculation est requis").max(120),
  vessel_type: z.enum(['pirogue', 'vedette', 'barge', 'ferry'], {
    errorMap: () => ({ message: 'Type inconnu : pirogue, vedette, barge ou ferry.' }),
  }),
  location: z.string().trim().min(1, 'Le lieu est requis').max(160),
  declared_capacity: z.coerce
    .number()
    .int('La capacité doit être un entier')
    .min(1, 'La capacité déclarée doit être au moins 1')
    .max(500, 'Capacité déclarée invraisemblable'),
});

/**
 * POST /api/v1/inspect
 * Raccourci : image + métadonnées, analyse immédiate (EF-11 à EF-18).
 *
 * multipart/form-data :
 *   - image             (fichier JPEG/PNG, 10 Mo max)
 *   - vessel_name       (texte)
 *   - vessel_type       (pirogue | vedette | barge | ferry)
 *   - location          (texte)
 *   - declared_capacity (entier)
 */
inspectRouter.post('/inspect', requireRole('agent', 'supervisor'), async (req, res, next) => {
  try {
    await receiveImage(req, res);

    if (!req.file?.buffer?.length) {
      throw new HttpError(400, 'MISSING_IMAGE', 'Aucune image reçue : le champ « image » est requis.');
    }

    const mimeType = sniffImageType(req.file.buffer);
    if (!mimeType) {
      throw new HttpError(
        415,
        'INVALID_IMAGE_CONTENT',
        "Le fichier reçu n'est pas une image JPEG ou PNG valide.",
      );
    }

    const parsed = inspectionMetadataSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Métadonnées invalides.', {
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await runInspection({
      image: req.file.buffer,
      mimeType,
      metadata: parsed.data,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});
