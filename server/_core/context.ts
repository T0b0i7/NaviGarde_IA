import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";
import { authenticateLocalRequest } from "./localAuth";
import { ensureCsrfToken, readCsrfCookie, verifyCsrf } from "./csrf";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /** Jeton CSRF courant, exposé au client via `auth.me`. */
  csrfToken: string;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateLocalRequest(opts.req);
  } catch {
    user = null;
  }

  // Un utilisateur authentifié qui mute l'état doit fournir le jeton. Les
  // visites anonymes (connexion, alerte marin) restent possibles.
  if (user && opts.req.method !== "GET" && opts.req.method !== "HEAD") {
    const path = opts.req.path.replace(/^\/api\/trpc\/?/, "").split("?")[0];
    const decision = verifyCsrf(opts.req, path || undefined);
    if (!decision.ok) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Requête refusée (protection CSRF) : ${decision.reason}.` });
    }
  }

  // Pose le jeton au client s'il n'en a pas encore.
  const csrfToken = ensureCsrfToken(opts.req, opts.res) ?? readCsrfCookie(opts.req) ?? "";

  return {
    req: opts.req,
    res: opts.res,
    user,
    csrfToken,
  };
}
