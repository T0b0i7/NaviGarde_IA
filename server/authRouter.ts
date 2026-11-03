import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addAuditEvent, createLocalUser, createPasswordResetToken, getUserByEmail, listUsers, setUserActive, setUserPassword, updateUserRole } from "./db";
import { endLocalSession, hashPassword, hashToken, normalizeEmail, startLocalSession, verifyPassword } from "./_core/localAuth";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const roleSchema = z.enum(["agent", "supervisor", "admin", "observer"]);
const passwordSchema = z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères.").max(160);
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number; lockedUntil: number }>();
function enforceLoginRateLimit(key: string) { const now = Date.now(); const current = loginAttempts.get(key); if (!current || now - current.firstAttemptAt > 15 * 60 * 1000) { loginAttempts.set(key, { count: 0, firstAttemptAt: now, lockedUntil: 0 }); return; } if (current.lockedUntil > now) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez dans quelques minutes." }); }
function registerLoginFailure(key: string) { const now = Date.now(); const current = loginAttempts.get(key) ?? { count: 0, firstAttemptAt: now, lockedUntil: 0 }; current.count += 1; if (current.count >= 5) current.lockedUntil = now + 15 * 60 * 1000; loginAttempts.set(key, current); }
function clearLoginFailures(key: string) { loginAttempts.delete(key); }
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.appRole !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Droits administrateur requis." });
  return next();
});

export const authRouter = router({
  login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const key = `${ctx.req.ip ?? "unknown"}:${normalizeEmail(input.email)}`; enforceLoginRateLimit(key);
    const user = await getUserByEmail(normalizeEmail(input.email));
    if (!user?.passwordHash || user.isActive !== 1 || !(await verifyPassword(input.password, user.passwordHash))) {
      registerLoginFailure(key);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Adresse e-mail ou mot de passe incorrect." });
    }
    clearLoginFailures(key);
    await startLocalSession(user.id, ctx.res, ctx.req);
    await addAuditEvent({ userId: user.id, action: "auth.login", entityType: "session", metadata: JSON.stringify({ method: "local" }) });
    return { success: true, user: { id: user.id, name: user.name, email: user.email, appRole: user.appRole } };
  }),
  requestPasswordReset: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ input }) => {
    const user = await getUserByEmail(normalizeEmail(input.email));
    if (!user || user.isActive !== 1) return { success: true, resetToken: null };
    const token = randomBytes(32).toString("base64url");
    await createPasswordResetToken({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    // Le fournisseur d’e-mail sera branché sur ce point. En développement, le token permet de tester le parcours sans fuite en production.
    return { success: true, resetToken: process.env.NODE_ENV === "production" ? null : token };
  }),
  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20), password: passwordSchema })).mutation(async ({ input }) => {
    const { consumePasswordResetToken } = await import("./db");
    const reset = await consumePasswordResetToken(hashToken(input.token));
    if (!reset) throw new TRPCError({ code: "BAD_REQUEST", message: "Jeton invalide ou expiré." });
    await setUserPassword(reset.userId, await hashPassword(input.password));
    return { success: true };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await endLocalSession(ctx.req, ctx.res);
    if (ctx.user) await addAuditEvent({ userId: ctx.user.id, action: "auth.logout", entityType: "session", metadata: JSON.stringify({ method: "local" }) });
    return { success: true };
  }),
  users: router({
    list: adminProcedure.query(() => listUsers()),
    create: adminProcedure.input(z.object({ name: z.string().min(2).max(160), email: z.string().email(), password: passwordSchema, appRole: roleSchema })).mutation(async ({ input, ctx }) => {
      const email = normalizeEmail(input.email);
      if (await getUserByEmail(email)) throw new TRPCError({ code: "CONFLICT", message: "Cette adresse e-mail existe déjà." });
      const created = await createLocalUser({ openId: `local_${randomBytes(24).toString("hex")}`, email, name: input.name.trim(), passwordHash: await hashPassword(input.password), appRole: input.appRole });
      await addAuditEvent({ userId: ctx.user.id, action: "user.create", entityType: "user", entityId: String(created.id), metadata: JSON.stringify({ email, appRole: input.appRole }) });
      return { success: true, id: created.id };
    }),
    changeRole: adminProcedure.input(z.object({ id: z.number().int().positive(), appRole: roleSchema })).mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id && input.appRole !== "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Un administrateur ne peut pas retirer ses propres droits." });
      const result = await updateUserRole(input.id, input.appRole); await addAuditEvent({ userId: ctx.user.id, action: "user.role_change", entityType: "user", entityId: String(input.id), metadata: JSON.stringify({ appRole: input.appRole }) }); return result;
    }),
    setActive: adminProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ input, ctx }) => { if (input.id === ctx.user.id && !input.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas désactiver votre propre compte." }); const result = await setUserActive(input.id, input.isActive); await addAuditEvent({ userId: ctx.user.id, action: input.isActive ? "user.activate" : "user.deactivate", entityType: "user", entityId: String(input.id) }); return result; }),
  }),
});
