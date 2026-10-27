import { HttpError } from '../lib/httpError.js';

const ROLES_CONNUS = new Set(['agent', 'supervisor', 'admin', 'sailor']);

/**
 * Garde de rôle (RBAC) — squelette de développement.
 *
 * TODO Phase 1 (EF-01 / EF-02) : remplacer la lecture de l'en-tête `x-dev-role`
 * par la vérification d'un JWT signé (durée courte) et charger l'utilisateur
 * depuis la base. La signature de la fonction ne changera pas : les routes
 * n'auront pas à être modifiées.
 *
 * En attendant, un utilisateur sans en-tête reçoit 401 et un utilisateur avec
 * un rôle non autorisé reçoit 403 — ce qui permet déjà de valider T01 et T02.
 *
 * @param {...string} rolesAutorises rôles acceptés sur la route
 */
export function requireRole(...rolesAutorises) {
  return (req, res, next) => {
    const role = req.get('x-dev-role');

    if (!role || !ROLES_CONNUS.has(role)) {
      return next(
        new HttpError(
          401,
          'UNAUTHENTICATED',
          "Authentification requise. En mode développement, fournir l'en-tête « x-dev-role » (agent, supervisor, admin, sailor).",
        ),
      );
    }

    if (!rolesAutorises.includes(role)) {
      return next(
        new HttpError(403, 'FORBIDDEN', `Le rôle « ${role} » n'est pas autorisé sur cette ressource.`),
      );
    }

    req.user = { role }; // remplacé par l'utilisateur issu du JWT en Phase 1
    return next();
  };
}
