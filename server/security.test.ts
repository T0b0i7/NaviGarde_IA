import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, verifyPassword } from "./_core/localAuth";

describe("security primitives", () => {
  it("hashes passwords with a unique salt and verifies only the original password", async () => {
    const first = await hashPassword("MotDePasseTresSolide!2026");
    const second = await hashPassword("MotDePasseTresSolide!2026");
    expect(first).not.toBe(second);
    expect(await verifyPassword("MotDePasseTresSolide!2026", first)).toBe(true);
    expect(await verifyPassword("mauvais-mot-de-passe", first)).toBe(false);
  });

  it("creates deterministic one-way token hashes", () => {
    expect(hashToken("session-token")).toHaveLength(64);
    expect(hashToken("session-token")).toBe(hashToken("session-token"));
    expect(hashToken("session-token")).not.toBe(hashToken("other-token"));
  });
});
