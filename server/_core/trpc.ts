import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (ctx.user.isActive !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account disabled" });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const requireRole = (allowed: Array<"agent" | "supervisor" | "admin" | "observer">) =>
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive !== 1) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account disabled" });
    }
    if (!allowed.includes(ctx.user.appRole as "agent" | "supervisor" | "admin" | "observer")) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

// Legacy adminProcedure kept for backward compatibility (role === 'admin')
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.isActive !== 1) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.role !== "admin" && ctx.user.appRole !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const supervisorProcedure = t.procedure.use(requireRole(["supervisor", "admin"]));
export const observerProcedure = t.procedure.use(requireRole(["observer", "supervisor", "admin"]));
export const adminAppProcedure = t.procedure.use(requireRole(["admin"]));
export const operationalProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }
    if (ctx.user.isActive !== 1) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Account disabled" });
    }
    if (ctx.user.appRole === "observer") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Le rôle Observateur est limité à la consultation." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);