import "server-only";

import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  cities,
  countries,
  divisions,
  gamerAchievements,
  gamerCredentials,
  gamerProfiles,
  games,
  roles,
  sessions,
  tournamentParticipantSnapshots,
  tournaments,
  userIdentities,
  userRoles,
  users,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import { hashPassword } from "@/lib/password";
import { playedGamesByGamer } from "@/lib/played-games";
import { uniqueProfileSlug } from "@/lib/slug";
import type { AchievementCategory } from "@/lib/achievement-labels";

export type AdminGamerListItem = {
  slug: string;
  displayName: string;
  handle: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  game: string | null;
  points: number;
  verificationStatus: string;
  accountStatus: string;
};

export type AdminGamerAchievementInput = {
  category: AchievementCategory;
  title: string;
  detail?: string | null;
  gameId?: string | null;
  yearLabel?: string | null;
};

export type AdminGamerPatch = {
  displayName?: string;
  handle?: string;
  bio?: string | null;
  cityId?: string | null;
  countryId?: string | null;
  profileVisibility?: "private" | "sponsors" | "public";
  verificationStatus?: "unverified" | "pending" | "verified" | "rejected";
  rankingPoints?: number;
  achievements?: AdminGamerAchievementInput[];
};

/** One row per gamer, with the identity and primary game the directory lists. */
export async function listAdminGamers(): Promise<AdminGamerListItem[]> {
  const rows = await db.select({
    id: gamerProfiles.id,
    slug: gamerProfiles.slug,
    displayName: gamerProfiles.displayName,
    handle: gamerProfiles.handle,
    points: gamerProfiles.rankingPoints,
    verificationStatus: gamerProfiles.verificationStatus,
    accountStatus: users.status,
    city: cities.name,
    userId: users.id,
  })
    .from(gamerProfiles)
    .innerJoin(users, eq(users.id, gamerProfiles.userId))
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .orderBy(desc(gamerProfiles.rankingPoints), asc(gamerProfiles.displayName));
  if (rows.length === 0) return [];

  const identities = await db.select({ userId: userIdentities.userId, type: userIdentities.type, value: userIdentities.normalizedValue })
    .from(userIdentities);
  const played = await playedGamesByGamer(rows.map((row) => row.id));

  return rows.map((row) => ({
    slug: row.slug,
    displayName: row.displayName,
    handle: row.handle,
    email: identities.find((entry) => entry.userId === row.userId && entry.type === "email")?.value ?? null,
    phone: identities.find((entry) => entry.userId === row.userId && entry.type === "phone")?.value ?? null,
    city: row.city,
    game: played.get(row.id)?.[0]?.game ?? null,
    points: row.points,
    verificationStatus: row.verificationStatus,
    accountStatus: row.accountStatus,
  }));
}

export async function getAdminGamer(slug: string) {
  const [profile] = await db.select({
    id: gamerProfiles.id,
    userId: gamerProfiles.userId,
    slug: gamerProfiles.slug,
    displayName: gamerProfiles.displayName,
    handle: gamerProfiles.handle,
    bio: gamerProfiles.bio,
    avatarUrl: gamerProfiles.avatarUrl,
    countryId: gamerProfiles.countryId,
    cityId: gamerProfiles.cityId,
    profileVisibility: gamerProfiles.profileVisibility,
    verificationStatus: gamerProfiles.verificationStatus,
    rankingPoints: gamerProfiles.rankingPoints,
    accountStatus: users.status,
    country: countries.name,
    city: cities.name,
    createdAt: gamerProfiles.createdAt,
  })
    .from(gamerProfiles)
    .innerJoin(users, eq(users.id, gamerProfiles.userId))
    .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .where(eq(gamerProfiles.slug, slug))
    .limit(1);
  if (!profile) return null;

  const [identities, played, achievementRows] = await Promise.all([
    db.select({ type: userIdentities.type, value: userIdentities.normalizedValue })
      .from(userIdentities).where(eq(userIdentities.userId, profile.userId)),
    playedGamesByGamer([profile.id]),
    db.select({
      id: gamerAchievements.id,
      category: gamerAchievements.category,
      title: gamerAchievements.title,
      detail: gamerAchievements.detail,
      gameId: gamerAchievements.gameId,
      yearLabel: gamerAchievements.yearLabel,
      sequence: gamerAchievements.sequence,
      verified: gamerAchievements.verified,
    }).from(gamerAchievements).where(eq(gamerAchievements.gamerId, profile.id))
      .orderBy(asc(gamerAchievements.category), asc(gamerAchievements.sequence)),
  ]);

  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    email: identities.find((entry) => entry.type === "email")?.value ?? null,
    phone: identities.find((entry) => entry.type === "phone")?.value ?? null,
    // Read-only: games come from tournaments played and career highlights.
    games: (played.get(profile.id) ?? []).map((entry) => ({ ...entry, inGameName: profile.handle, primaryRole: null, platform: null })),
    achievements: achievementRows,
  };
}

export type CreateAdminGamerInput = {
  displayName: string;
  handle: string;
  email: string;
  password: string;
  phone?: string | null;
  countryId?: string | null;
  cityId?: string | null;
};

export async function createAdminGamer(input: CreateAdminGamerInput, actorUserId: string) {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: userIdentities.id }).from(userIdentities)
      .where(or(
        and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, email)),
        ...(input.phone ? [and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, input.phone))] : []),
      )).limit(1);
    if (taken) throw new LifecycleError("EMAIL_IN_USE", "An account already uses this email address or mobile number.", 409);

    const [gamerRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.key, "gamer")).limit(1);
    if (!gamerRole) throw new LifecycleError("GAMER_ROLE_MISSING", "The gamer role has not been seeded.", 500);

    const [user] = await tx.insert(users).values({ status: "active" }).returning({ id: users.id });
    await tx.insert(userIdentities).values({ userId: user.id, type: "email", normalizedValue: email, verifiedAt: new Date() });
    if (input.phone) {
      await tx.insert(userIdentities).values({ userId: user.id, type: "phone", normalizedValue: input.phone, verifiedAt: new Date() });
    }
    // Created by an operator, so the player must replace the temporary password.
    await tx.insert(gamerCredentials).values({ userId: user.id, passwordHash, mustChangePassword: true });
    await tx.insert(userRoles).values({ userId: user.id, roleId: gamerRole.id, scopeType: "platform" });

    const slug = await uniqueProfileSlug(tx, input.displayName);
    const [profile] = await tx.insert(gamerProfiles).values({
      userId: user.id,
      slug,
      displayName: input.displayName,
      handle: input.handle,
      countryId: input.countryId ?? null,
      cityId: input.cityId ?? null,
    }).returning({ id: gamerProfiles.id, slug: gamerProfiles.slug });

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "gamer.created",
      entityType: "gamer_profile",
      entityId: profile.id,
      metadata: { slug: profile.slug, email },
    });
    return { slug: profile.slug, email };
  });
}

export async function updateAdminGamer(slug: string, patch: AdminGamerPatch, actorUserId: string) {
  return db.transaction(async (tx) => {
    const [profile] = await tx.select({ id: gamerProfiles.id }).from(gamerProfiles)
      .where(eq(gamerProfiles.slug, slug)).limit(1);
    if (!profile) return null;

    const fields = {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.cityId !== undefined ? { cityId: patch.cityId } : {}),
      ...(patch.countryId !== undefined ? { countryId: patch.countryId } : {}),
      ...(patch.profileVisibility !== undefined ? { profileVisibility: patch.profileVisibility } : {}),
      ...(patch.verificationStatus !== undefined ? { verificationStatus: patch.verificationStatus } : {}),
      ...(patch.rankingPoints !== undefined ? { rankingPoints: patch.rankingPoints } : {}),
    };
    if (Object.keys(fields).length > 0) {
      await tx.update(gamerProfiles).set({ ...fields, updatedAt: new Date() }).where(eq(gamerProfiles.id, profile.id));
    }

    if (patch.achievements) {
      await tx.delete(gamerAchievements).where(eq(gamerAchievements.gamerId, profile.id));
      if (patch.achievements.length > 0) {
        await tx.insert(gamerAchievements).values(patch.achievements.map((entry, index) => ({
          gamerId: profile.id,
          category: entry.category,
          title: entry.title,
          detail: entry.detail ?? null,
          gameId: entry.gameId ?? null,
          yearLabel: entry.yearLabel ?? null,
          sequence: index,
          // An operator entering the record is the verification.
          verified: true,
        })));
      }
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "gamer.updated",
      entityType: "gamer_profile",
      entityId: profile.id,
      metadata: { slug, fields: Object.keys(fields) },
    });
    return profile.id;
  });
}

export async function resetGamerPassword(slug: string, password: string, actorUserId: string) {
  const passwordHash = await hashPassword(password);
  return db.transaction(async (tx) => {
    const [account] = await tx.select({ userId: users.id }).from(gamerProfiles)
      .innerJoin(users, eq(users.id, gamerProfiles.userId))
      .where(eq(gamerProfiles.slug, slug)).limit(1);
    if (!account) return null;

    await tx.insert(gamerCredentials).values({ userId: account.userId, passwordHash, mustChangePassword: true })
      .onConflictDoUpdate({
        target: gamerCredentials.userId,
        set: { passwordHash, mustChangePassword: true, updatedAt: new Date() },
      });
    const revoked = await tx.update(sessions).set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, account.userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "gamer.password_reset",
      entityType: "user",
      entityId: account.userId,
      metadata: { slug, revokedSessions: revoked.length },
    });
    return { revokedSessions: revoked.length };
  });
}

/** Recorded tournament results for one player, newest first. */
export async function getAdminGamerPlacements(gamerId: string) {
  const rows = await db.select({
    tournamentName: tournaments.name,
    gameName: games.name,
    startsAt: tournaments.startsAt,
    datePrecision: tournaments.datePrecision,
    finalRank: tournamentParticipantSnapshots.finalRank,
    placementLabel: tournamentParticipantSnapshots.placementLabel,
  })
    .from(tournamentParticipantSnapshots)
    .innerJoin(tournaments, eq(tournaments.id, tournamentParticipantSnapshots.tournamentId))
    .innerJoin(divisions, eq(divisions.id, tournamentParticipantSnapshots.divisionId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .where(eq(tournamentParticipantSnapshots.participantId, gamerId))
    .orderBy(sql`${tournaments.startsAt} desc nulls last`);

  return rows.map((row) => ({
    tournamentName: row.tournamentName,
    gameName: row.gameName,
    year: row.datePrecision === "unknown" ? null : row.startsAt?.getFullYear() ?? null,
    finalRank: row.finalRank,
    placementLabel: row.placementLabel,
  }));
}

/** Players available to be entered into a competition. */
export async function listSelectableGamers() {
  return db.select({
    id: gamerProfiles.id,
    slug: gamerProfiles.slug,
    displayName: gamerProfiles.displayName,
    handle: gamerProfiles.handle,
  })
    .from(gamerProfiles)
    .innerJoin(users, eq(users.id, gamerProfiles.userId))
    .where(eq(users.status, "active"))
    .orderBy(asc(gamerProfiles.displayName));
}
