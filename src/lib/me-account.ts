import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, gamerCredentials, sessions, userIdentities } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/password";

export type AccountMutationResult =
  | { ok: true; revokedSessions?: number }
  | { ok: false; reason: "NO_PASSWORD" | "INVALID_PASSWORD" | "EMAIL_TAKEN" | "SAME_PASSWORD" };

export async function changeOwnPassword(
  userId: string,
  sessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AccountMutationResult> {
  return db.transaction(async (transaction) => {
    const [credentials] = await transaction.select({ passwordHash: gamerCredentials.passwordHash })
      .from(gamerCredentials).where(eq(gamerCredentials.userId, userId)).for("update").limit(1);
    if (!credentials) return { ok: false as const, reason: "NO_PASSWORD" as const };
    if (!(await verifyPassword(currentPassword, credentials.passwordHash))) {
      return { ok: false as const, reason: "INVALID_PASSWORD" as const };
    }
    if (await verifyPassword(newPassword, credentials.passwordHash)) {
      return { ok: false as const, reason: "SAME_PASSWORD" as const };
    }

    const changedAt = new Date();
    await transaction.update(gamerCredentials)
      .set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: changedAt })
      .where(eq(gamerCredentials.userId, userId));

    const revoked = await transaction.update(sessions)
      .set({ revokedAt: changedAt })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.id, sessionId)))
      .returning({ id: sessions.id });

    await transaction.insert(auditEvents).values({
      actorUserId: userId,
      action: "gamer.password_changed",
      entityType: "user",
      entityId: userId,
      metadata: { revokedSessions: revoked.length },
    });
    return { ok: true as const, revokedSessions: revoked.length };
  });
}

export async function changeOwnEmail(
  userId: string,
  currentPassword: string,
  email: string,
): Promise<AccountMutationResult> {
  const normalized = email.trim().toLowerCase();
  return db.transaction(async (transaction) => {
    const [credentials] = await transaction.select({ passwordHash: gamerCredentials.passwordHash })
      .from(gamerCredentials).where(eq(gamerCredentials.userId, userId)).limit(1);
    if (!credentials) return { ok: false as const, reason: "NO_PASSWORD" as const };
    if (!(await verifyPassword(currentPassword, credentials.passwordHash))) {
      return { ok: false as const, reason: "INVALID_PASSWORD" as const };
    }

    const [taken] = await transaction.select({ userId: userIdentities.userId }).from(userIdentities)
      .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, normalized))).limit(1);
    if (taken && taken.userId !== userId) return { ok: false as const, reason: "EMAIL_TAKEN" as const };

    const [existing] = await transaction.select({ id: userIdentities.id, value: userIdentities.normalizedValue })
      .from(userIdentities)
      .where(and(eq(userIdentities.userId, userId), eq(userIdentities.type, "email")))
      .limit(1);

    if (existing) {
      if (existing.value === normalized) return { ok: true as const };
      await transaction.update(userIdentities)
        .set({ normalizedValue: normalized, verifiedAt: null, updatedAt: new Date() })
        .where(eq(userIdentities.id, existing.id));
    } else {
      await transaction.insert(userIdentities).values({ userId, type: "email", normalizedValue: normalized });
    }

    await transaction.insert(auditEvents).values({
      actorUserId: userId,
      action: "gamer.email_changed",
      entityType: "user",
      entityId: userId,
      metadata: { previousEmail: existing?.value ?? null, email: normalized },
    });
    return { ok: true as const };
  });
}
