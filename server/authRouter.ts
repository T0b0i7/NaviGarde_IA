import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addAuditEvent, archiveUser, createLocalUser, createPasswordResetToken, getUserByEmail, listUsers, restoreUser, setUserActive, setUserPassword, updateUserRole } from "./db";
import { endLocalSession, hashPassword, hashToken, normalizeEmail, startLocalSession, verifyPassword } from "./_core/localAuth";
import { MemoryRateLimiter } from "./_core/rateLimiter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const roleSchema = z.enum(["agent", "supervisor", "admin", "observer"]);
const passwordSchema = z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères.").max(160);

/**
 * Deux portées pour la connexion :
 *  - par IP + e-mail : une IP qui devine un compte précis ;
 *  - par e-mail seul : une attaque distribuée qui change d'IP à chaque essai.
 *    Sans cette seconde portée, changer d'adresse suffisait à contourner le
 *    verrou complet.
 */
const loginAttemptsByIp = new MemoryRateLimiter({ max: 5, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
const loginAttemptsByAccount = new MemoryRateLimiter({ max: 10, windowMs: 15 * 60 * 1000, lockMs: 15 * 60 * 1000 });
const resetAttempts = new MemoryRateLimiter({ max: 10, windowMs: 60 * 60 * 1000, lockMs: 60 * 60 * 1000 });

function tooManyAttempts(retryAfterSeconds: number): TRPCError {
  return new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} minute(s).`,
  });
}

/** Identifiant réseau normalisé, compatible Express derrière un proxy. */
function clientIp(req: { ip?: string; headers?: Record<string, unknown> }) {
  const raw = (req?.ip ?? req?.headers?.["x-forwarded-for"] ?? "unknown").toString().split(",")[0].trim();
  return raw.slice(0, 64);
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.appRole !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Droits administrateur requis." });
  return next();
});

export const authRouter = router({
  login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1), remember: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
    const email = normalizeEmail(input.email);
    const ipKey = `${clientIp(ctx.req)}:${email}`;
    const accountKey = email;

    // Les deux portées sont contrôlées avant toute vérification coûteuse (scrypt),
    // pour que le blocage protège aussi le CPU du serveur.
    const [ipDecision, accountDecision] = await Promise.all([
      loginAttemptsByIp.consume(ipKey),
      loginAttemptsByAccount.consume(accountKey),
    ]);
    if (!ipDecision.allowed) throw tooManyAttempts(ipDecision.retryAfterSeconds);
    if (!accountDecision.allowed) throw tooManyAttempts(accountDecision.retryAfterSeconds);

    const user = await getUserByEmail(email);
    if (!user?.passwordHash || user.isActive !== 1 || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Adresse e-mail ou mot de passe incorrect." });
    }

    await Promise.all([loginAttemptsByIp.reset(ipKey), loginAttemptsByAccount.reset(accountKey)]);
    await startLocalSession(user.id, ctx.res, ctx.req, input.remember ? 30 : 7);
    await addAuditEvent({ userId: user.id, action: "auth.login", entityType: "session", metadata: JSON.stringify({ method: "local", remember: input.remember }) });
    return { success: true, user: { id: user.id, name: user.name, email: user.email, appRole: user.appRole } };
  }),
  requestPasswordReset: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ input, ctx }) => {
    const ipLimit = await resetAttempts.consume(`reset:${clientIp(ctx.req)}`);
    if (!ipLimit.allowed) throw tooManyAttempts(ipLimit.retryAfterSeconds);
    const email = normalizeEmail(input.email);
    const user = await getUserByEmail(email);
    // Réponse identique que le compte existe ou non : ne pas révéler les adresses.
    if (!user || user.isActive !== 1) return { success: true, resetToken: null };
    const token = randomBytes(32).toString("base64url");
    await createPasswordResetToken({ userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    return { success: true, resetToken: process.env.NODE_ENV === "production" ? null : token };
  }),
  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20), password: passwordSchema })).mutation(async ({ input, ctx }) => {
    const ipLimit = await resetAttempts.consume(`reset:${clientIp(ctx.req)}`);
    if (!ipLimit.allowed) throw tooManyAttempts(ipLimit.retryAfterSeconds);
    const { consumePasswordResetToken } = await import("./db");
    const reset = await consumePasswordResetToken(hashToken(input.token));
    if (!reset) throw new TRPCError({ code: "BAD_REQUEST", message: "Jeton invalide ou expiré." });
    await setUserPassword(reset.userId, await hashPassword(input.password));
    await addAuditEvent({ userId: reset.userId, action: "auth.password_reset", entityType: "user", entityId: String(reset.userId) });
    return { success: true };
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    await endLocalSession(ctx.req, ctx.res);
    if (ctx.user) await addAuditEvent({ userId: ctx.user.id, action: "auth.logout", entityType: "session", metadata: JSON.stringify({ method: "local" }) });
    return { success: true };
  }),
  users: router({
    list: adminProcedure.input(z.object({ scope: z.enum(["active", "archived", "all"]).default("active") }).optional()).query(({ input }) => listUsers(input?.scope ?? "active")),
    archive: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas archiver votre propre compte." });
      const result = await archiveUser(input.id, ctx.user.id);
      await addAuditEvent({ userId: ctx.user.id, action: "user.archive", entityType: "user", entityId: String(input.id), ip: String(ctx.req.ip ?? "").slice(0, 64) });
      return result;
    }),
    restore: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const result = await restoreUser(input.id);
      await addAuditEvent({ userId: ctx.user.id, action: "user.restore", entityType: "user", entityId: String(input.id) });
      return result;
    }),
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
