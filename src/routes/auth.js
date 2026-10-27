/**
 * Routes d'authentification et de gestion des utilisateurs (EF-01 à EF-05).
 *
 * POST   /auth/login      — connexion (publique)
 * GET    /auth/me         — profil courant (jeton requis)
 * POST   /users           — créer un compte (admin)
 * PATCH  /users/:id       — modifier rôle/actif/nom/email (admin)
 * DELETE /users/:id       — désactiver un compte (admin)
 *
 * Format d'erreur uniforme : { status: 'error', code, message, details? }
 */

import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { requireRole } from '../middleware/auth.js';
import {
  login,
  register,
  getProfile,
  getAllUsers,
  modifyUser,
  disableUser,
} from '../services/authService.js';

const authRouter = Router();

/* ------------------------------------------------------------------ */
/* Schémas de validation                                              */
/* ------------------------------------------------------------------ */

const loginSchema = z.object({
  email: z.string().email('Email invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

const registerSchema = z.object({
  nom: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Email invalide.'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
    .max(128),
  role: z.enum(['agent', 'supervisor', 'admin']).default('agent'),
});

const updateUserSchema = z
  .object({
    nom: z.string().trim().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(['agent', 'supervisor', 'admin']).optional(),
    actif: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ à modifier est requis.',
  });

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

/** POST /auth/login — connexion, renvoie un JWT. */
authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_INPUT', 'Identifiants invalides.', {
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    const result = await login({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

/** GET /auth/me — profil de l'utilisateur courant. */
authRouter.get('/me', requireRole('agent', 'supervisor', 'admin'), async (req, res, next) => {
  try {
    const result = await getProfile(req.user.sub);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

/** POST /users — créer un compte (admin). */
authRouter.post(
  '/users',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new HttpError(400, 'INVALID_INPUT', 'Données du compte invalides.', {
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      const result = await register({
        nom: parsed.data.nom,
        email: parsed.data.email,
        password: parsed.data.password,
        role: parsed.data.role,
      });

      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  },
);

/** PATCH /users/:id — modifier un compte (admin). */
authRouter.patch(
  '/users/:id',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new HttpError(400, 'INVALID_INPUT', 'Modification invalide.', {
          fields: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      // Empêcher un admin de se désactiver lui-même.
      if (parsed.data.actif === false && req.params.id === req.user.sub) {
        throw new HttpError(403, 'SELF_DEACTIVATION_FORBIDDEN', 'Vous ne pouvez pas désactiver votre propre compte.');
      }

      const result = await modifyUser(req.params.id, parsed.data);
      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  },
);

/** DELETE /users/:id — désactiver un compte (admin, soft delete). */
authRouter.delete('/users/:id', requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) {
      throw new HttpError(403, 'SELF_DEACTIVATION_FORBIDDEN', 'Vous ne pouvez pas désactiver votre propre compte.');
    }

    await disableUser(req.params.id);
    return res.status(200).json({ status: 'success', user_id: req.params.id, actif: false });
  } catch (error) {
    return next(error);
  }
});

export default authRouter;
