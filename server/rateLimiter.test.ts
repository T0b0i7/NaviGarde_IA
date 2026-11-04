import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./_core/rateLimiter";

describe("limitation des tentatives de connexion", () => {
  it("autorise les tentatives sous la limite puis bloque", async () => {
    const limiter = new MemoryRateLimiter({ max: 3, windowMs: 60_000, lockMs: 60_000 });
    for (let i = 0; i < 3; i++) {
      expect((await limiter.consume("a")).allowed).toBe(true);
    }
    const blocked = await limiter.consume("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isole chaque clé", async () => {
    const limiter = new MemoryRateLimiter({ max: 1, windowMs: 60_000, lockMs: 60_000 });
    // Quota de 1 : la première tentative passe, la seconde est bloquée.
    expect((await limiter.consume("ip-1")).allowed).toBe(true);
    expect((await limiter.consume("ip-1")).allowed).toBe(false);
    // Une autre clé conserve son propre quota intact.
    expect((await limiter.consume("ip-2")).allowed).toBe(true);
  });

  it("remet le compteur à zéro après une authentification réussie", async () => {
    const limiter = new MemoryRateLimiter({ max: 1, windowMs: 60_000, lockMs: 60_000 });
    await limiter.consume("compte");
    await limiter.consume("compte"); // bloqué
    await limiter.reset("compte");
    expect((await limiter.consume("compte")).allowed).toBe(true);
  });

  it("libère les entrées expirées", async () => {
    const limiter = new MemoryRateLimiter({ max: 5, windowMs: 10, lockMs: 10 });
    await limiter.consume("vieux");
    expect(limiter.size()).toBe(1);
    await new Promise((resolve) => setTimeout(resolve, 25));
    await limiter.prune();
    expect(limiter.size()).toBe(0);
  });

  it("protège un compte même si l'attaquant change d'IP", async () => {
    // Simulateur : une portée par e-mail, indépendante de la portée par IP.
    const byAccount = new MemoryRateLimiter({ max: 2, windowMs: 60_000, lockMs: 60_000 });
    const byIp = new MemoryRateLimiter({ max: 5, windowMs: 60_000, lockMs: 60_000 });
    const attempt = async (ip: string) => {
      const [ipOk, accountOk] = await Promise.all([byIp.consume(`${ip}:cible`), byAccount.consume("cible")]);
      return ipOk.allowed && accountOk.allowed;
    };
    expect(await attempt("1.1.1.1")).toBe(true);
    expect(await attempt("2.2.2.2")).toBe(true);
    // Troisième IP : la limite par IP est neuve, la limite globale du compte bloque.
    expect(await attempt("3.3.3.3")).toBe(false);
  });
});
