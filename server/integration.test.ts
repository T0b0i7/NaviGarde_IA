process.env.DATABASE_URL = "mysql://root:@localhost:3306/navigarde";

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { hashPassword } from "./_core/localAuth";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../drizzle/schema";
import { eq } from "drizzle-orm";

const TEST_EMAIL = "integration-test@navigarde.bj";
const TEST_PASSWORD = "IntegrationTest123!";

let testUserId: number;
let ctx: any;

beforeAll(async () => {
  const connection = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  await connection.query("USE navigarde;");
  const db = drizzle(connection);

  const hash = await hashPassword(TEST_PASSWORD);
  const result = await db.insert(schema.users).values({
    openId: "integration-test",
    name: "Integration Test",
    email: TEST_EMAIL,
    loginMethod: "local",
    role: "admin",
    appRole: "admin",
    passwordHash: hash,
    isActive: 1,
  }).execute();
  testUserId = Number(result[0].insertId);

  const { authenticateLocalRequest } = await import("./_core/localAuth");
  ctx = {
    user: { id: testUserId, openId: "integration-test", name: "Integration Test", email: TEST_EMAIL, loginMethod: "local", role: "admin", appRole: "admin", passwordHash: hash, isActive: 1, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {}, protocol: "https" } as any,
    res: { cookie: () => {}, clearCookie: () => {} } as any,
  };
  await connection.end();
});

afterAll(async () => {
  const connection = await mysql.createConnection({ host: "localhost", port: 3306, user: "root", password: "" });
  await connection.query("USE navigarde;");
  const db = drizzle(connection);
  await db.delete(schema.users).where(eq(schema.users.email, TEST_EMAIL));
  await connection.end();
});

describe("Intégration - Auth et Bulletins", () => {
  it("crée un utilisateur et vérifie qu'il est en base", async () => {
    const { getUserByEmail } = await import("./db");
    const user = await getUserByEmail(TEST_EMAIL);
    expect(user).toBeDefined();
    expect(user.appRole).toBe("admin");
  });

  it("liste les bulletins via tRPC avec un appelant authentifié", async () => {
    const caller = appRouter.createCaller(ctx);
    const bulletins = await caller.data.bulletins.list();
    expect(Array.isArray(bulletins)).toBe(true);
  });

  it("crée un bulletin via tRPC", async () => {
    const caller = appRouter.createCaller(ctx);
    const created = await caller.data.bulletins.create({
      title: "Test intégration bulletin",
      category: "Météo",
      maritimeZone: "Golfe de Guinée",
      importance: "information",
      content: "Contenu de test pour l'intégration",
      attachments: [],
    });
    expect(created.id).toBeDefined();

    // Vérifier que le bulletin existe en base
    const list = await caller.data.bulletins.list();
    expect(list.some((b) => b.id === created.id && b.title === "Test intégration bulletin")).toBe(true);

    // Nettoyage
    const { update } = caller.data.bulletins;
    await update({ id: created.id, patch: { status: "archive" } });
  });

  it("liste les embarcations via tRPC", async () => {
    const caller = appRouter.createCaller(ctx);
    const vessels = await caller.data.vessels.list();
    expect(Array.isArray(vessels)).toBe(true);
  });

  it("liste les alertes via tRPC", async () => {
    const caller = appRouter.createCaller(ctx);
    const alerts = await caller.data.alerts.list();
    expect(Array.isArray(alerts)).toBe(true);
  });
});
