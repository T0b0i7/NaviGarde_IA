/**
 * Jeton CSRF côté client.
 *
 * Le serveur pose un cookie `navigarde_csrf` lisible (non HttpOnly). Le
 * navigateur refuse de l'écrire depuis JavaScript via `document.cookie` quand
 * il est `HttpOnly`, mais l'interdit aussi en lecture : on le lit donc ici et
 * on le renvoie dans l'en-tête `x-csrf-token` exigé par le serveur.
 *
 * Si le cookie est absent (première visite, cookie purgé), on force un
 * rechargement de la session une seule fois pour que le serveur en émette un.
 */
export const CSRF_COOKIE = "navigarde_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function readCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
