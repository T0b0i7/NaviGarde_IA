import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { CSRF_COOKIE, CSRF_HEADER, procedureFromPath, verifyCsrf } from "./_core/csrf";

function makeRequest(method: string, headers: Record<string, string> = {}): Request {
  return { method, headers, protocol: "https" } as unknown as Request;
}

const TOKEN = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

describe("protection CSRF", () => {
  it("laisse passer les lectures", () => {
    expect(verifyCsrf(makeRequest("GET")).ok).toBe(true);
    expect(verifyCsrf(makeRequest("HEAD")).ok).toBe(true);
  });

  it("refuse une mutation authentifiée sans jeton", () => {
    const decision = verifyCsrf(makeRequest("POST"));
    expect(decision.ok).toBe(false);
  });

  it("refuse une mutation avec le cookie mais sans en-tête", () => {
    const decision = verifyCsrf(makeRequest("POST", { cookie: `${CSRF_COOKIE}=${TOKEN}` }));
    expect(decision.ok).toBe(false);
  });

  it("refuse un en-tête qui ne correspond pas au cookie", () => {
    const decision = verifyCsrf(
      makeRequest("POST", { cookie: `${CSRF_COOKIE}=${TOKEN}`, [CSRF_HEADER]: "jeton-attaquant-different-0000000000" }),
    );
    expect(decision.ok).toBe(false);
  });

  it("refuse un en-tête de même longueur mais différent", () => {
    const forged = TOKEN.slice(0, -1) + "X";
    const decision = verifyCsrf(makeRequest("POST", { cookie: `${CSRF_COOKIE}=${TOKEN}`, [CSRF_HEADER]: forged }));
    expect(decision.ok).toBe(false);
  });

  it("accepte une mutation avec jeton concordant", () => {
    const decision = verifyCsrf(makeRequest("POST", { cookie: `${CSRF_COOKIE}=${TOKEN}`, [CSRF_HEADER]: TOKEN }));
    expect(decision.ok).toBe(true);
  });

  it("couvre PUT, PATCH et DELETE", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      expect(verifyCsrf(makeRequest(method)).ok).toBe(false);
    }
  });

  it("exempte les procédures qui établissent la session", () => {
    for (const procedure of ["localAuth.login", "localAuth.resetPassword", "localAuth.requestPasswordReset", "auth.logout"]) {
      expect(verifyCsrf(makeRequest("POST"), procedure).ok).toBe(true);
    }
  });

  it("n'exempte pas les mutations métier", () => {
    expect(verifyCsrf(makeRequest("POST"), "data.vessels.create").ok).toBe(false);
    expect(verifyCsrf(makeRequest("POST"), "localAuth.users.create").ok).toBe(false);
  });

  it("identifie la procédure depuis le chemin tRPC", () => {
    expect(procedureFromPath("localAuth.login")).toBe("localAuth.login");
    expect(procedureFromPath("localAuth.resetPassword")).toBe("localAuth.resetPassword");
    expect(procedureFromPath("localAuth.requestPasswordReset")).toBe("localAuth.requestPasswordReset");
    expect(procedureFromPath("/api/trpc/localAuth.login")).toBe("localAuth.login");
    // Une procédure métier garde son préfixe de routeur : elle ne peut donc
    // pas correspondre à une exemption écrite en `routeur.procédure`.
    expect(procedureFromPath("data.vessels.create")).toBe("data.vessels.create");
    expect(procedureFromPath("localAuth.users.login")).toBe("localAuth.users.login");
  });
});
