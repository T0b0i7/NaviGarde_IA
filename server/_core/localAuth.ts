import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { createAuthSession, getUserBySessionToken, revokeAuthSession } from "../db";

export const LOCAL_SESSION_COOKIE = "navigarde_session";
const SESSION_DAYS = 7;
const scrypt = promisify(scryptCallback);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  if (!stored?.startsWith("scrypt$")) return false;
  const [, salt, expectedHex] = stored.split("$");
  if (!salt || !expectedHex) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isSecureRequest(request?: Request) {
  if (!request) return process.env.NODE_ENV === "production";
  const proto = (request.headers["x-forwarded-proto"] as string) || request.protocol || "";
  if (proto.includes("https")) return true;
  const host = (request.headers.host as string) || "";
  // localhost / 127.0.0.1 / LAN en HTTP → cookie non-Secure, sinon le navigateur le rejette
  if (!host || host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.168.") || host.startsWith("10.")) return false;
  return process.env.NODE_ENV === "production";
}

export function setLocalSessionCookie(response: Response, token: string, request?: Request) {
  const secure = isSecureRequest(request);
  response.cookie(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearLocalSessionCookie(response: Response, request?: Request) {
  const secure = isSecureRequest(request);
  response.clearCookie(LOCAL_SESSION_COOKIE, { httpOnly: true, secure, sameSite: secure ? "none" : "lax", path: "/" });
}

export async function startLocalSession(userId: number, response: Response, request?: Request) {
  const token = randomBytes(32).toString("base64url");
  await createAuthSession({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) });
  setLocalSessionCookie(response, token, request);
}

export async function authenticateLocalRequest(request: Request) {
  const token = parseCookieHeader(request.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;
  const user = await getUserBySessionToken(hashToken(token));
  if (!user || user.isActive !== 1) return null;
  return user as User;
}

export async function endLocalSession(request: Request, response: Response) {
  const token = parseCookieHeader(request.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (token) await revokeAuthSession(hashToken(token));
  clearLocalSessionCookie(response, request);
}
