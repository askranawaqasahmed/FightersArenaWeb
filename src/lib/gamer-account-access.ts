import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, gamerProfiles, sessions, users } from "@/db/schema";

export type GamerAccountStatus = typeof users.$inferSelect.status;
export type ManageableGamerAccountStatus = Extract<GamerAccountStatus, "active" | "suspended">;

export async function getGamerAccountBySlug(slug: string) {
  const [account] = await db.select({
    userId: users.id,
    slug: gamerProfiles.slug,
    status: users.status,
  }).from(gamerProfiles)
    .innerJoin(users, eq(users.id, gamerProfiles.userId))
    .where(eq(gamerProfiles.slug, slug))
    .limit(1);
  return account ?? null;
}

export async function getGamerAccountStatuses() {
  return db.select({ slug: gamerProfiles.slug, status: users.status })
    .from(gamerProfiles)
    .innerJoin(users, eq(users.id, gamerProfiles.userId));
}

export async function setGamerAccountStatus(
  slug: string,
  status: ManageableGamerAccountStatus,
  actorUserId: string,
) {
  return db.transaction(async (transaction) => {
    const [account] = await transaction.select({
      userId: users.id,
      status: users.status,
    }).from(gamerProfiles)
      .innerJoin(users, eq(users.id, gamerProfiles.userId))
      .where(eq(gamerProfiles.slug, slug))
      .for("update")
      .limit(1);
    if (!account) return null;
    if (account.status === "deleted") return { blocked: true as const, account };
    if (account.status === status) return { blocked: false as const, account: { ...account, status } };

    const changedAt = new Date();
    await transaction.update(users).set({ status, updatedAt: changedAt }).where(eq(users.id, account.userId));
    let revokedSessions = 0;
    if (status === "suspended") {
      const revoked = await transaction.update(sessions)
        .set({ revokedAt: changedAt })
        .where(and(eq(sessions.userId, account.userId), isNull(sessions.revokedAt)))
        .returning({ id: sessions.id });
      revokedSessions = revoked.length;
    }
    await transaction.insert(auditEvents).values({
      actorUserId,
      action: status === "suspended" ? "gamer.blocked" : "gamer.unblocked",
      entityType: "user",
      entityId: account.userId,
      metadata: { slug, previousStatus: account.status, status, revokedSessions },
    });
    return {
      blocked: false as const,
      account: { userId: account.userId, status },
      revokedSessions,
    };
  });
}
