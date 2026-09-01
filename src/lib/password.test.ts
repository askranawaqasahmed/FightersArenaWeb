import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("admin password hashing", () => {
  it("verifies the correct password without storing it in plaintext", async () => {
    const password = "SecureAdmin123!";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toContain(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("WrongPassword123!", passwordHash)).resolves.toBe(false);
  });

  it("rejects malformed stored hashes", async () => {
    await expect(verifyPassword("anything", "not-a-password-hash")).resolves.toBe(false);
  });
});
