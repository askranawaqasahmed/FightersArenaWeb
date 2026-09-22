/**
 * Adds Babarzaki and backfills the profile copy for players seeded before
 * `bio`/`avatarUrl`/`displayName` were part of the go-live seed.
 *
 * `seed-content.ts` is guarded by a one-time audit marker and has already run in
 * production, so it can no longer introduce a new player. This script is the
 * additive follow-up: it is idempotent, it never overwrites a field an operator
 * has since edited in the portal, and it can be re-run safely.
 */
import { eq, or, and, isNull } from "drizzle-orm";
import { db, sqlClient } from "./client";
import {
  gamerAchievements,
  gamerCredentials,
  gamerGames,
  gamerProfiles,
  roles,
  tournamentParticipantSnapshots,
  userIdentities,
  userRoles,
  users,
} from "./schema";
import { hashPassword } from "@/lib/password";
import { referenceIds, seedId } from "./seed-data/ids";
import { gameIdByKey } from "./seed-data/games";
import { startsAtFor, tournamentByKey } from "./seed-data/tournaments";
import { seedGamers } from "./seed-data/gamers";

const GAMER_PASSWORD = process.env.SEED_GAMER_PASSWORD ?? "123456";

async function run() {
  const [gamerRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "gamer")).limit(1);
  if (!gamerRole) throw new Error("gamer role missing. Run `npm run db:seed` first.");
  const passwordHash = await hashPassword(GAMER_PASSWORD);

  for (const [gamerIndex, gamer] of seedGamers.entries()) {
    const idLane = gamerIndex + 1;
    const [existing] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles)
      .where(eq(gamerProfiles.slug, gamer.slug)).limit(1);

    if (existing) {
      // Only fill blanks. A bio or avatar set from the portal is the operator's and stays.
      if (gamer.bio) {
        await db.update(gamerProfiles).set({ bio: gamer.bio })
          .where(and(eq(gamerProfiles.id, existing.id), or(isNull(gamerProfiles.bio), eq(gamerProfiles.bio, ""))));
      }
      if (gamer.avatarUrl) {
        await db.update(gamerProfiles).set({ avatarUrl: gamer.avatarUrl })
          .where(and(eq(gamerProfiles.id, existing.id), isNull(gamerProfiles.avatarUrl)));
      }
      // Unlike the copy fields, this one is set outright: it names a file shipped with
      // the build rather than anything written in the portal, so replacing the PDF and
      // re-running is how a designed profile gets updated.
      if (gamer.profilePdfUrl) {
        await db.update(gamerProfiles).set({ profilePdfUrl: gamer.profilePdfUrl })
          .where(eq(gamerProfiles.id, existing.id));
      }
      if (gamer.displayName) {
        await db.update(gamerProfiles).set({ displayName: gamer.displayName })
          .where(and(eq(gamerProfiles.id, existing.id), eq(gamerProfiles.displayName, gamer.handle)));
      }
      console.log(`Updated profile copy for ${gamer.handle}.`);
      continue;
    }

    const [identityTaken] = await db.select({ userId: userIdentities.userId }).from(userIdentities)
      .where(or(
        and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, gamer.email)),
        and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, gamer.phone)),
      )).limit(1);
    if (identityTaken) {
      console.log(`Skipping ${gamer.handle}: that email or phone already belongs to an account.`);
      continue;
    }

    await db.insert(users).values({ id: gamer.userId, status: "active", acceptedTermsVersion: "2026-08" }).onConflictDoNothing();
    await db.insert(userIdentities).values([
      { userId: gamer.userId, type: "email", normalizedValue: gamer.email, verifiedAt: new Date() },
      { userId: gamer.userId, type: "phone", normalizedValue: gamer.phone, verifiedAt: new Date() },
    ]).onConflictDoNothing();
    await db.insert(gamerCredentials).values({ userId: gamer.userId, passwordHash, mustChangePassword: true }).onConflictDoNothing();
    await db.insert(userRoles).values({ userId: gamer.userId, roleId: gamerRole.id, scopeType: "platform" }).onConflictDoNothing();

    await db.insert(gamerProfiles).values({
      id: gamer.profileId,
      userId: gamer.userId,
      slug: gamer.slug,
      displayName: gamer.displayName ?? gamer.handle,
      handle: gamer.handle,
      bio: gamer.bio ?? null,
      avatarUrl: gamer.avatarUrl ?? null,
      profilePdfUrl: gamer.profilePdfUrl ?? null,
      countryId: referenceIds.pakistan,
      profileVisibility: "public",
      verificationStatus: "verified",
    }).onConflictDoNothing();

    await db.insert(gamerGames).values(gamer.gameKeys.map((gameKey) => ({
      gamerId: gamer.profileId,
      gameId: gameIdByKey[gameKey],
      inGameName: gamer.handle,
      verified: true,
    }))).onConflictDoNothing();

    await db.insert(tournamentParticipantSnapshots).values(gamer.placements.map((placement, index) => {
      const tournament = tournamentByKey[placement.tournamentKey];
      if (!tournament) throw new Error(`Unknown tournament key: ${placement.tournamentKey}`);
      return {
        id: seedId(3001 + index, idLane),
        tournamentId: tournament.id,
        divisionId: tournament.divisionId,
        participantId: gamer.profileId,
        participantType: "gamer" as const,
        displayName: gamer.handle,
        finalRank: placement.finalRank,
        placementLabel: placement.placementLabel ?? null,
        profileSnapshot: { source: "historical-import" },
        rosterSnapshot: (placement.teammates ?? []).map((name) => ({ displayName: name })),
        sponsorSnapshot: [],
        capturedAt: startsAtFor(tournament) ?? new Date(),
      };
    })).onConflictDoNothing();

    await db.insert(gamerAchievements).values(gamer.achievements.map((achievement, index) => ({
      id: seedId(4001 + index, idLane),
      gamerId: gamer.profileId,
      category: achievement.category,
      title: achievement.title,
      detail: achievement.detail ?? null,
      gameId: achievement.gameKey ? gameIdByKey[achievement.gameKey] : null,
      yearLabel: achievement.yearLabel ?? null,
      sequence: index,
      verified: true,
    }))).onConflictDoNothing();

    console.log(`Seeded ${gamer.handle} (${gamer.email}).`);
  }
}

run()
  .then(() => console.log("Player sync complete."))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => sqlClient.end());
