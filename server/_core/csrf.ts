import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";

/**
 * Protection CSRF par double soumission (double submit cookie).
 *
 * POURQUOI
 * --------
 * Le cookie de session est `SameSite=None` quand l'application est affichée
 * dans une iframe d'aperçu cross-site. Dans cette configuration, un site tiers
 * peut déclencher une requête authentifiée (POST tRPC) depuis le navigateur
 * de la victime. `SameSite` ne protège plus.
 *
 * MÉCANISME
 * ---------
 *  - le serveur émet un jeton aléatoire dans un cookie **lisible par le
 *    JavaScript de première partie** (`navigarde_csrf`, volontairement non
 *    HttpOnly) ;
 *  - le client recopie ce jeton dans l'en-tête `x-csrf-token` de chaque
 *    mutation ;
 *  - le serveur refuse toute mutation dont l'en-tête ne correspond pas au
 *    cookie.
 *
 * Un site tiers ne peut pas lire le cookie (origine différente) : il ne peut
 * donc pas construire l'en-tête, même en déclenchant la requête.
 *
 * PORTÉE
 * ------
 * Seules les requêtes mutantes et authentifiées sont contrôlées. La connexion
 * et la réinitialisation de mot de passe ne changent pas l'état d'un utilisateur
 * connecté et n'ont pas de session à détourner.
 */

export const CSRF_COOKIE = "navigarde_csrf";
export const CSRF_HEADER = "x-csrf-token";
const TOKEN_BYTES = 32;

/** Requêtes soumises au contrôle (les GET/HEAD ne modifient rien). */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Procédures qui établissent la session : exemptées, aucune session à voler. */
const SESSION_ESTABLISHING_PROCEDURES = new Set([
  "localAuth.login",
  "localAuth.requestPasswordReset",
  "localAuth.resetPassword",
  "auth.logout",
]);

export function isMutating(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function readCsrfCookie(req: Request): string | undefined {
  return parseCookieHeader(req.headers.cookie ?? "")[CSRF_COOKIE];
}

/** Crée et pose un jeton, si la requête n'en a pas déjà un. */
export function ensureCsrfToken(req: Request, res: Response): string {
  const existing = readCsrfCookie(req);
  if (existing && existing.length >= 32) return existing;
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // doit être lisible par le client pour renvoyer l'en-tête
    secure: isSecureRequest(req),
    sameSite: isSecureRequest(req) ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

function isSecureRequest(request: Request) {
  const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol || "";
  if (proto.includes("https")) return true;
  const host = (request.headers.host as string) || "";
  if (!host || host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.168.") || host.startsWith("10.")) return false;
  return process.env.NODE_ENV === "production";
}

export type CsrfDecision = { ok: true } | { ok: false; reason: string };

/**
 * Vérifie une requête mutante.
 *
 * `procedurePath` vaut `undefined` pour un POST tRPC dont le chemin n'est pas
 * identifiable : dans ce cas on applique la vérification.
 */
export function verifyCsrf(req: Request, procedurePath?: string): CsrfDecision {
  if (!isMutating(req.method)) return { ok: true };
  if (procedurePath && SESSION_ESTABLISHING_PROCEDURES.has(procedurePath)) return { ok: true };

  const cookie = readCsrfCookie(req);
  const header = String(req.headers[CSRF_HEADER] ?? "");

  if (!cookie) return { ok: false, reason: "Cookie CSRF absent" };
  if (!header) return { ok: false, reason: `En-tête ${CSRF_HEADER} absent` };
  if (cookie.length !== header.length) return { ok: false, reason: "Jeton CSRF invalide" };

  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: "Jeton CSRF invalide" };
}

/** Extrait `routeur.procédure` d'un POST tRPC (`<routeur>.<procédure>`). */
export function procedureFromPath(path: string): string | undefined {
  const segments = path.replace(/^\/api\/trpc\/?/, "").split("/").filter(Boolean);
  if (!segments.length) return undefined;
  return segments[segments.length - 1];
}
