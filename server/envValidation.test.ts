import { describe, expect, it } from "vitest";
import { inspectEnvironment } from "./_core/envValidation";

const SAFE_URL = "mysql://navigarde_app:s3cr3t-strong-value-123456@127.0.0.1:3306/navigarde";

describe("validation de l'environnement", () => {
  it("accepte une configuration production correcte", () => {
    const report = inspectEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: SAFE_URL,
      MANUS_JWT_SECRET: "x".repeat(48),
      BASETEN_API_KEY: "key",
    } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.summary.databaseUser).toBe("navigarde_app");
  });

  it("refuse le compte root en production", () => {
    const report = inspectEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "mysql://root:@localhost:3306/navigarde",
    } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
    const issue = report.issues.find((i) => i.variable === "DATABASE_URL");
    expect(issue?.message).toMatch(/superutilisateur/);
  });

  it("signale aussi le compte root en développement", () => {
    const report = inspectEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "mysql://root:@localhost:3306/navigarde",
    } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
  });

  it("refuse une base absente", () => {
    const report = inspectEnvironment({ NODE_ENV: "production" } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.variable === "DATABASE_URL")).toBe(true);
  });

  it("refuse un protocole non MySQL", () => {
    const report = inspectEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://navigarde_app:secret@localhost:5432/navigarde",
    } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => /Protocole/.test(i.message))).toBe(true);
  });

  it("refuse une URL de connexion illisible", () => {
    const report = inspectEnvironment({ NODE_ENV: "production", DATABASE_URL: "pas une url" } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => /Format invalide/.test(i.message))).toBe(true);
  });

  it("refuse un mot de passe vide en production, l'accepte en développement", () => {
    const url = "mysql://navigarde_app:@localhost:3306/navigarde";
    expect(inspectEnvironment({ NODE_ENV: "production", DATABASE_URL: url } as NodeJS.ProcessEnv).ok).toBe(false);
    expect(inspectEnvironment({ NODE_ENV: "development", DATABASE_URL: url } as NodeJS.ProcessEnv).ok).toBe(true);
  });

  it("refuse un secret de signature trop court en production", () => {
    const report = inspectEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: SAFE_URL,
      MANUS_JWT_SECRET: "court",
    } as NodeJS.ProcessEnv);
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.variable === "MANUS_JWT_SECRET")).toBe(true);
  });

  it("ne journalise jamais le mot de passe dans le résumé", () => {
    const report = inspectEnvironment({ NODE_ENV: "production", DATABASE_URL: SAFE_URL } as NodeJS.ProcessEnv);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("s3cr3t-strong-value-123456");
  });
});
