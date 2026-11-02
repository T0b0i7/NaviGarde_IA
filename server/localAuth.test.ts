import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./_core/localAuth";

describe("local authentication", () => {
  it("hashes passwords and rejects invalid credentials", async () => {
    const hash = await hashPassword("MotDePasseTresSolide!2026");
    expect(hash).toMatch(/^scrypt\$/);
    expect(await verifyPassword("MotDePasseTresSolide!2026", hash)).toBe(true);
    expect(await verifyPassword("mauvais-mot-de-passe", hash)).toBe(false);
  });
});
