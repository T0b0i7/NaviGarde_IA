import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function makeContext(role: User["role"], appRole: User["appRole"], isActive = 1): TrpcContext {
  const user: User = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    appRole,
    passwordHash: null,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("RBAC", () => {
  it("blocks observer from creating vessels", async () => {
    const ctx = makeContext("user", "observer");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.data.vessels.create({ registrationNumber: "X", type: "bateau", ownerName: "Owner", place: "Port", capacity: 1 })).rejects.toThrow();
  });

  it("allows supervisor to list vessels", async () => {
    const ctx = makeContext("user", "supervisor");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.data.vessels.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("blocks non-admin from removing vessels", async () => {
    const ctx = makeContext("user", "supervisor");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.data.vessels.remove({ id: 1 })).rejects.toThrow();
  });

  it("blocks disabled user", async () => {
    const ctx = makeContext("admin", "admin", 0);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.data.vessels.list()).rejects.toThrow();
  });
});