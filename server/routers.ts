import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { aiRouter } from "./aiRouter";
import { dataRouter } from "./dataRouter";
import { predictiveRouter } from "./predictiveRouter";
import { authRouter } from "./authRouter";
import { endLocalSession, LOCAL_SESSION_COOKIE } from "./_core/localAuth";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  ai: aiRouter,
  data: dataRouter,
  predictive: predictiveRouter,
  localAuth: authRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      const hasLocalSession = (ctx.req.headers.cookie ?? "").includes(`${LOCAL_SESSION_COOKIE}=`);
      return (hasLocalSession ? endLocalSession(ctx.req, ctx.res) : Promise.resolve()).then(() => ({
        success: true,
      } as const));
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
