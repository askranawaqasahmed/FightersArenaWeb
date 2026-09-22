import { and, eq, or } from "drizzle-orm";
import { db, sqlClient } from "./client";
import {
  auditEvents,
  divisions,
  gamerAchievements,
  gamerCredentials,
  gamerGames,
  gamerProfiles,
  games,
  roles,
  sponsors,
  sponsorships,
  tournamentParticipantSnapshots,
  tournaments,
  userIdentities,
  userRoles,
  users,
} from "./schema";
import { hashPassword } from "@/lib/password";
import { GO_LIVE_SEED_ACTION, referenceIds, seedId } from "./seed-data/ids";
import { gameIdByKey, seedGames } from "./seed-data/games";
import { datePrecisionFor, seedTournaments, startsAtFor, tournamentByKey } from "./seed-data/tournaments";
import { seedGamers, seedSponsor } from "./seed-data/gamers";

const GAMER_PASSWORD = process.env.SEED_GAMER_PASSWORD ?? "123456";

async function alreadySeeded() {
  const [marker] = await db.select({ id: auditEvents.id }).from(auditEvents)
    .where(eq(auditEvents.action, GO_LIVE_SEED_ACTION)).limit(1);
  return Boolean(marker);
}

async function seedContent() {
  if (await alreadySeeded()) {
    console.log("Go-live content already seeded; skipping. Manage records from the admin portal.");
    return;
  }

  // 1. Tournaments (each named event once, shared events included).
  await db.insert(tournaments).values(seedTournaments.map((tournament) => ({
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    competitionType: tournament.competitionType,
    description: tournament.description ?? null,
    status: "completed" as const,
    countryId: referenceIds.pakistan,
    startsAt: startsAtFor(tournament),
    endsAt: startsAtFor(tournament),
    completedAt: startsAtFor(tournament),
    online: tournament.online ?? true,
    featured: false,
    hasBracket: false,
    datePrecision: datePrecisionFor(tournament),
  }))).onConflictDoNothing();

  // 2. Games.
  await db.insert(games).values(seedGames.map((game) => ({
    id: game.id,
    slug: game.slug,
    name: game.name,
    genre: "Fighting",
    publisher: game.publisher,
    teamSize: 1,
    coverGradient: game.coverGradient,
  }))).onConflictDoNothing();

  // 3. One division per tournament. No stages/matches: these are historical results.
  await db.insert(divisions).values(seedTournaments.map((tournament) => ({
    id: tournament.divisionId,
    tournamentId: tournament.id,
    gameId: gameIdByKey[tournament.gameKey],
    name: tournament.competitionType === "league" ? "League" : "Main bracket",
    competitionType: tournament.competitionType,
    status: "completed" as const,
    participantType: "gamer" as const,
    maxParticipants: 2,
    rosterMin: 1,
    rosterMax: 1,
  }))).onConflictDoNothing();

  await db.insert(sponsors).values({
    id: seedSponsor.id,
    slug: seedSponsor.slug,
    name: seedSponsor.name,
    category: seedSponsor.category,
  }).onConflictDoNothing();

  const [gamerRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "gamer")).limit(1);
  if (!gamerRole) throw new Error("gamer role missing. Run `npm run db:seed` first.");
  const passwordHash = await hashPassword(GAMER_PASSWORD);

  // 4. Gamers, their placements and their career highlights.
  for (const [gamerIndex, gamer] of seedGamers.entries()) {
    // Snapshot and achievement ids are namespaced per gamer, so adding a player never
    // reuses an id already issued to an earlier one.
    const idLane = gamerIndex + 1;
    // Never overwrite a player who already exists: they may have changed email/password/bio.
    const [existing] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles)
      .where(eq(gamerProfiles.slug, gamer.slug)).limit(1);
    const [identityTaken] = await db.select({ userId: userIdentities.userId }).from(userIdentities)
      .where(or(
        and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, gamer.email)),
        and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, gamer.phone)),
      )).limit(1);
    if (existing || identityTaken) {
      console.log(`Skipping ${gamer.handle}: an account already exists.`);
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
        sponsorSnapshot: placement.tournamentKey === "arcadecafe-2014"
          ? [{ name: seedSponsor.name, slug: seedSponsor.slug, category: seedSponsor.category }]
          : [],
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

    if (gamer.key === "kashif") {
      await db.insert(sponsorships).values({
        id: seedId(602, 0),
        sponsorId: seedSponsor.id,
        subjectType: "gamer",
        subjectId: gamer.profileId,
        status: "ended",
        public: true,
      }).onConflictDoNothing();
    }

    console.log(`Seeded ${gamer.handle} (${gamer.email}).`);
  }

  await db.insert(auditEvents).values({
    action: GO_LIVE_SEED_ACTION,
    entityType: "platform",
    metadata: {
      tournaments: seedTournaments.length,
      games: seedGames.length,
      gamers: seedGamers.map((gamer) => gamer.slug),
    },
  });
}

seedContent()
  .then(() => console.log("Go-live content seeded."))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => sqlClient.end());
