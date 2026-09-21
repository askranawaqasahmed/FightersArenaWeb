import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { auditEvents, gamerCredentials, gamerProfiles, sessions, userIdentities, users } from "@/db/schema";
import { changeOwnEmail } from "@/lib/me-account";
import { hashPassword, verifyPassword } from "@/lib/password";
import { uniqueProfileSlug } from "@/lib/slug";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("password signup primitives against PostgreSQL", () => {
  it("creates a user with an email identity, credentials, and a collision-free profile slug", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const email = `signup-${suffix}@fightersarena.com`;
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
        await tx.insert(userIdentities).values({ userId: user.id, type: "email", normalizedValue: email });
        await tx.insert(gamerCredentials).values({ userId: user.id, passwordHash });
        const slug = await uniqueProfileSlug(tx, displayName);
        expect(slug).toBe(`${takenSlug}-2`);
        await tx.insert(gamerProfiles).values({ userId: user.id, slug, displayName, handle: slug });

        // Login lookup path: email identity joined to credentials.
        const [account] = await tx.select({
          userId: users.id,
          status: users.status,
          passwordHash: gamerCredentials.passwordHash,
        }).from(userIdentities)
          .innerJoin(users, eq(users.id, userIdentities.userId))
          .innerJoin(gamerCredentials, eq(gamerCredentials.userId, users.id))
          .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, email)))
          .limit(1);
        expect(account.userId).toBe(user.id);
        expect(await verifyPassword("correct horse battery", account.passwordHash)).toBe(true);
        expect(await verifyPassword("wrong password", account.passwordHash)).toBe(false);

        // A second signup with the same email must be detectable before insert.
        const [duplicate] = await tx.select({ id: userIdentities.id }).from(userIdentities)
          .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, email))).limit(1);
        expect(duplicate).toBeDefined();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});

describe("changing the sign-in email against PostgreSQL", () => {
  it("moves the identity and revokes every session", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const oldEmail = `before-${suffix}@fightersarena.com`;
    const newEmail = `after-${suffix}@fightersarena.com`;
    const [user] = await db.insert(users).values({ status: "active" }).returning();

    try {
      await db.insert(userIdentities).values({ userId: user.id, type: "email", normalizedValue: oldEmail });
      await db.insert(gamerCredentials).values({ userId: user.id, passwordHash: await hashPassword("start-password") });
      await db.insert(gamerProfiles).values({
        userId: user.id,
        slug: `email-change-${suffix}`,
        displayName: `Email Change ${suffix}`,
        handle: `EC${suffix}`,
      });
      await db.insert(sessions).values([
        { userId: user.id, tokenHash: `hash-a-${suffix}`, familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) },
        { userId: user.id, tokenHash: `hash-b-${suffix}`, familyId: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) },
      ]);

      const result = await changeOwnEmail(user.id, "start-password", newEmail.toUpperCase());
      expect(result).toMatchObject({ ok: true, revokedSessions: 2 });

      // The address moved rather than being duplicated, and is stored lowercase.
      const identities = await db.select().from(userIdentities)
        .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.type, "email")));
      expect(identities).toHaveLength(1);
      expect(identities[0].normalizedValue).toBe(newEmail);

      // Every session is revoked, so the player must sign in again.
      const live = await db.select().from(sessions)
        .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
      expect(live).toHaveLength(0);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorUserId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  });

  it("refuses an address another account already uses", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const sharedEmail = `taken-${suffix}@fightersarena.com`;
    const [owner] = await db.insert(users).values({ status: "active" }).returning();
    const [other] = await db.insert(users).values({ status: "active" }).returning();

    try {
      await db.insert(userIdentities).values({ userId: owner.id, type: "email", normalizedValue: sharedEmail });
      await db.insert(userIdentities).values({ userId: other.id, type: "email", normalizedValue: `other-${suffix}@fightersarena.com` });
      await db.insert(gamerCredentials).values({ userId: other.id, passwordHash: await hashPassword("start-password") });

      await expect(changeOwnEmail(other.id, "start-password", sharedEmail))
        .resolves.toMatchObject({ ok: false, reason: "EMAIL_TAKEN" });
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorUserId, other.id));
      await db.delete(users).where(eq(users.id, owner.id));
      await db.delete(users).where(eq(users.id, other.id));
    }
  });
});
