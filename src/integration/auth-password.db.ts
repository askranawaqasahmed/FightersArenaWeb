import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { gamerCredentials, gamerProfiles, userIdentities, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { uniqueProfileSlug } from "@/lib/slug";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("password signup primitives against PostgreSQL", () => {
  it("creates a user with phone identity, credentials, and a collision-free profile slug", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const phone = `+92300${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;
        const displayName = `Signup Player ${suffix}`;

        // An existing profile occupying the natural slug forces the -2 suffix.
        const [collisionUser] = await tx.insert(users).values({ status: "active" }).returning();
        const takenSlug = `signup-player-${suffix.toLowerCase()}`;
        await tx.insert(gamerProfiles).values({
          userId: collisionUser.id,
          slug: takenSlug,
          displayName: "Slug Squatter",
          handle: "SQUAT",
        });

        const passwordHash = await hashPassword("correct horse battery");
        const [user] = await tx.insert(users).values({ status: "active", acceptedTermsVersion: "2026-08" }).returning();
        await tx.insert(userIdentities).values({ userId: user.id, type: "phone", normalizedValue: phone });
        await tx.insert(gamerCredentials).values({ userId: user.id, passwordHash });
        const slug = await uniqueProfileSlug(tx, displayName);
        expect(slug).toBe(`${takenSlug}-2`);
        await tx.insert(gamerProfiles).values({ userId: user.id, slug, displayName, handle: slug });

        // Login lookup path: phone identity joined to credentials.
        const [account] = await tx.select({
          userId: users.id,
          status: users.status,
          passwordHash: gamerCredentials.passwordHash,
        }).from(userIdentities)
          .innerJoin(users, eq(users.id, userIdentities.userId))
          .innerJoin(gamerCredentials, eq(gamerCredentials.userId, users.id))
          .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, phone)))
          .limit(1);
        expect(account.userId).toBe(user.id);
        expect(await verifyPassword("correct horse battery", account.passwordHash)).toBe(true);
        expect(await verifyPassword("wrong password", account.passwordHash)).toBe(false);

        // A second signup with the same phone must be detectable before insert.
        const [duplicate] = await tx.select({ id: userIdentities.id }).from(userIdentities)
          .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, phone))).limit(1);
        expect(duplicate).toBeDefined();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
