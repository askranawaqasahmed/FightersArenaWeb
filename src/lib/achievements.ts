import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { gamerAchievements, gamerProfiles, games } from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import { achievementCategories } from "@/lib/achievement-labels";

export const achievementInputSchema = z.object({
  category: z.enum(achievementCategories),
  title: z.string().trim().min(2).max(200),
  detail: z.string().trim().max(2000).nullish(),
  gameId: z.uuid().nullish(),
  yearLabel: z.string().trim().max(40).nullish(),
  sequence: z.number().int().min(0).max(999).optional(),
});

export type AchievementInput = z.infer<typeof achievementInputSchema>;

async function requireOwnProfileId(userId: string) {
  const [profile] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles)
    .where(eq(gamerProfiles.userId, userId)).limit(1);
  if (!profile) throw new LifecycleError("PROFILE_REQUIRED", "Create your player profile before adding achievements.", 409);
  return profile.id;
}

export async function listOwnAchievements(userId: string) {
  const gamerId = await requireOwnProfileId(userId);
  return db.select({
    id: gamerAchievements.id,
    category: gamerAchievements.category,
    title: gamerAchievements.title,
    detail: gamerAchievements.detail,
    gameId: gamerAchievements.gameId,
    gameName: games.name,
    yearLabel: gamerAchievements.yearLabel,
    sequence: gamerAchievements.sequence,
    verified: gamerAchievements.verified,
  })
    .from(gamerAchievements)
    .leftJoin(games, eq(games.id, gamerAchievements.gameId))
    .where(eq(gamerAchievements.gamerId, gamerId))
    .orderBy(asc(gamerAchievements.category), asc(gamerAchievements.sequence));
}

export async function createOwnAchievement(userId: string, input: AchievementInput) {
  const gamerId = await requireOwnProfileId(userId);
  const [created] = await db.insert(gamerAchievements).values({
    gamerId,
    category: input.category,
    title: input.title,
    detail: input.detail ?? null,
    gameId: input.gameId ?? null,
    yearLabel: input.yearLabel ?? null,
    sequence: input.sequence ?? 0,
    // A player editing their own record cannot mark it verified; only an admin can.
    verified: false,
  }).returning({ id: gamerAchievements.id });
  return created.id;
}

export async function updateOwnAchievement(userId: string, achievementId: string, input: AchievementInput) {
  const gamerId = await requireOwnProfileId(userId);
  const updated = await db.update(gamerAchievements).set({
    category: input.category,
    title: input.title,
    detail: input.detail ?? null,
    gameId: input.gameId ?? null,
    yearLabel: input.yearLabel ?? null,
    ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
    verified: false,
    updatedAt: new Date(),
  })
    .where(and(eq(gamerAchievements.id, achievementId), eq(gamerAchievements.gamerId, gamerId)))
    .returning({ id: gamerAchievements.id });
  return updated.length > 0;
}

export async function deleteOwnAchievement(userId: string, achievementId: string) {
  const gamerId = await requireOwnProfileId(userId);
  const removed = await db.delete(gamerAchievements)
    .where(and(eq(gamerAchievements.id, achievementId), eq(gamerAchievements.gamerId, gamerId)))
    .returning({ id: gamerAchievements.id });
  return removed.length > 0;
}
