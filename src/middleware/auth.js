/**
 * Garde d'authentification et contrôle d'accès par rôle (EF-01, EF-02, EF-04).
 *
 * Remplace le squelette `x-dev-role` par une vérification JWT :
 *   - le token arrive dans l'en-tête `Authorization: Bearer <jwt>` ;
 *   - le JWT est signé, de durée courte (JWT_EXPIRES_IN, défaut 30 min) ;
 *   - `req.user` est peuplé avec { sub, email, role } issu du token.
 *
 * La signature de la fonction ne change pas : les routes existantes n'ont pas
 * à être modifiées (requireRole('agent', 'supervisor', ...) fonctionne tel quel).
 */

import { HttpError } from '../lib/httpError.js';
import { verifyToken } from '../services/authService.js';

const ROLES_CONNUS = new Set(['agent', 'supervisor', 'admin', 'sailor']);

function extractToken(req) {
  const header = req.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Middleware : authentifie via JWT, puis vérifie le rôle.
 * @param {...string} rolesAutorises rôles acceptés sur la route
 */
export function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return next(
        new HttpError(
          401,
          'UNAUTHENTICATED',
          'Authentification requise. Fournissez un jeton Bearer dans l\'en-tête Authorization.',
        ),
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(
        new HttpError(401, 'TOKEN_INVALID_OR_EXPIRED', 'Jeton invalide ou expiré. Reconnexion requise.'),
      );
    }

    if (!ROLES_CONNUS.has(payload.role)) {
      return next(new HttpError(403, 'ROLE_UNKNOWN', `Rôle inconnu : ${payload.role}.`));
    }

    if (!rolesAutorises.includes(payload.role)) {
      return next(
        new HttpError(403, 'FORBIDDEN', `Le rôle '${payload.role}' n'est pas autorisé sur cette ressource.`),
      );
    }

    req.user = payload; // { sub, email, role }
    return next();
  };
}

/** Middleware léger : authentifie sans vérifier de rôle particulier. */
export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next(
      new HttpError(
        401,
        'UNAUTHENTICATED',
        'Authentification requise. Fournissez un jeton Bearer dans l\'en-tête Authorization.',
      ),
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return next(
      new HttpError(401, 'TOKEN_INVALID_OR_EXPIRED', 'Jeton invalide ou expiré. Reconnexion requise.'),
    );
  }

  req.user = payload;
  return next();
}

export { ROLES_CONNUS };
