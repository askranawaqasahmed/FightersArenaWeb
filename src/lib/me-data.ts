import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cities,
  countries,
  divisions,
  gamerProfiles,
  games,
  registrations,
  tournaments,
  userIdentities,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import { playedGamesByGamer } from "@/lib/played-games";
import { uniqueProfileSlug } from "@/lib/slug";

export type OwnProfilePatch = {
  displayName?: string;
  handle?: string;
  bio?: string | null;
  countryId?: string | null;
  cityId?: string | null;
  profileVisibility?: "private" | "sponsors" | "public";
};

export async function getOwnProfile(userId: string) {
  const [profile] = await db
    .select({
      id: gamerProfiles.id,
      slug: gamerProfiles.slug,
      displayName: gamerProfiles.displayName,
      handle: gamerProfiles.handle,
      bio: gamerProfiles.bio,
      avatarUrl: gamerProfiles.avatarUrl,
      profileVisibility: gamerProfiles.profileVisibility,
      verificationStatus: gamerProfiles.verificationStatus,
      rankingPoints: gamerProfiles.rankingPoints,
      countryId: gamerProfiles.countryId,
      cityId: gamerProfiles.cityId,
      country: countries.name,
      city: cities.name,
      createdAt: gamerProfiles.createdAt,
    })
    .from(gamerProfiles)
    .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .where(eq(gamerProfiles.userId, userId))
    .limit(1);
  if (!profile) return null;

  const identityRows = await db
    .select({ type: userIdentities.type, value: userIdentities.normalizedValue, verifiedAt: userIdentities.verifiedAt })
    .from(userIdentities)
    .where(eq(userIdentities.userId, userId));
  // Games come from tournaments played and career highlights; the handle is the in-game name.
  const played = (await playedGamesByGamer([profile.id])).get(profile.id) ?? [];
  const gameRows = played.map((entry) => ({ ...entry, inGameName: profile.handle, primaryRole: null, platform: null }));

  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    identities: identityRows.map((row) => ({ type: row.type, value: row.value, verified: row.verifiedAt !== null })),
    games: gameRows,
  };
}

export async function upsertOwnProfile(userId: string, patch: OwnProfilePatch) {
  return db.transaction(async (tx) => {
    if (patch.cityId || patch.countryId) {
      if (patch.countryId) {
        const [country] = await tx.select({ id: countries.id }).from(countries).where(eq(countries.id, patch.countryId)).limit(1);
        if (!country) throw new LifecycleError("COUNTRY_NOT_FOUND", "The selected country was not found.", 422);
      }
      if (patch.cityId) {
        const [city] = await tx.select({ id: cities.id, countryId: cities.countryId }).from(cities).where(eq(cities.id, patch.cityId)).limit(1);
        if (!city) throw new LifecycleError("CITY_NOT_FOUND", "The selected city was not found.", 422);
        if (patch.countryId && city.countryId !== patch.countryId) {
          throw new LifecycleError("CITY_COUNTRY_MISMATCH", "The selected city does not belong to the selected country.", 422);
        }
      }
    }

    const [existing] = await tx.select({ id: gamerProfiles.id }).from(gamerProfiles).where(eq(gamerProfiles.userId, userId)).limit(1);
    const fieldChanges = {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.countryId !== undefined ? { countryId: patch.countryId } : {}),
      ...(patch.cityId !== undefined ? { cityId: patch.cityId } : {}),
      ...(patch.profileVisibility !== undefined ? { profileVisibility: patch.profileVisibility } : {}),
    };

    let profileId: string;
    if (existing) {
      profileId = existing.id;
      if (Object.keys(fieldChanges).length > 0) {
        await tx.update(gamerProfiles).set({ ...fieldChanges, updatedAt: new Date() }).where(eq(gamerProfiles.id, existing.id));
      }
    } else {
      // Legacy OTP-created accounts have no profile yet; the first PATCH creates one.
      if (!patch.displayName) throw new LifecycleError("DISPLAY_NAME_REQUIRED", "A display name is required to create your profile.", 422);
      const slug = await uniqueProfileSlug(tx, patch.displayName);
      const [created] = await tx.insert(gamerProfiles).values({
        userId,
        slug,
        displayName: patch.displayName,
        handle: patch.handle ?? slug,
        bio: patch.bio ?? null,
        countryId: patch.countryId ?? null,
        cityId: patch.cityId ?? null,
        ...(patch.profileVisibility ? { profileVisibility: patch.profileVisibility } : {}),
      }).returning({ id: gamerProfiles.id });
      profileId = created.id;
    }
    return profileId;
  });
}

export async function getOwnRegistrations(userId: string) {
  const rows = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      eligible: registrations.eligible,
      checkedInAt: registrations.checkedInAt,
      seed: registrations.seed,
      createdAt: registrations.createdAt,
      divisionId: divisions.id,
      divisionName: divisions.name,
      divisionStatus: divisions.status,
      game: games.name,
      tournamentId: tournaments.id,
      tournamentSlug: tournaments.slug,
      tournamentName: tournaments.name,
      tournamentStatus: tournaments.status,
      bannerUrl: tournaments.bannerUrl,
      startsAt: tournaments.startsAt,
    })
    .from(registrations)
    .innerJoin(gamerProfiles, and(eq(gamerProfiles.id, registrations.participantId), eq(gamerProfiles.userId, userId)))
    .innerJoin(divisions, eq(divisions.id, registrations.divisionId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .where(eq(registrations.participantType, "gamer"))
    .orderBy(desc(registrations.createdAt));

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    eligible: row.eligible,
    checkedIn: row.checkedInAt !== null,
    seed: row.seed,
    registeredAt: row.createdAt.toISOString(),
    tournament: {
      id: row.tournamentId,
      slug: row.tournamentSlug,
      name: row.tournamentName,
      status: row.tournamentStatus,
      bannerUrl: row.bannerUrl,
      startsAt: row.startsAt?.toISOString() ?? null,
    },
    division: {
      id: row.divisionId,
      name: row.divisionName,
      status: row.divisionStatus,
      game: row.game,
    },
  }));
}
