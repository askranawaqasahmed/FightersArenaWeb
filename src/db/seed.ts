import { and, eq } from "drizzle-orm";
import { db, sqlClient } from "./client";
import {
  adminCredentials,
  countries,
  cities,
  divisions,
  gamerGames,
  gamerProfiles,
  games,
  homepageSlides,
  permissions,
  registrations,
  roles,
  sponsors,
  stages,
  standings,
  tournaments,
  userIdentities,
  userRoles,
  users,
} from "./schema";
import { hashPassword } from "@/lib/password";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@ideageek.pk";

function requireSuperadminPassword(): string {
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required to seed the superadmin account.");
  }
  return password;
}

const SUPERADMIN_PASSWORD = requireSuperadminPassword();
const DEMO_GAMER_PHONE = "+923001234567";

const ids = {
  pakistan: "00000000-0000-4000-8000-000000000001",
  karachi: "00000000-0000-4000-8000-000000000011",
  lahore: "00000000-0000-4000-8000-000000000012",
  islamabad: "00000000-0000-4000-8000-000000000013",
  dota: "00000000-0000-4000-8000-000000000101",
  valorant: "00000000-0000-4000-8000-000000000102",
  tekken: "00000000-0000-4000-8000-000000000103",
  pubg: "00000000-0000-4000-8000-000000000104",
  national: "00000000-0000-4000-8000-000000000201",
  superAdmin: "00000000-0000-4000-8000-000000000301",
  gamerUser: "00000000-0000-4000-8000-000000000302",
  gamerProfile: "00000000-0000-4000-8000-000000000303",
  proLeague: "00000000-0000-4000-8000-000000000202",
  nationalDivision: "00000000-0000-4000-8000-000000000401",
  leagueDivision: "00000000-0000-4000-8000-000000000402",
  nationalStage: "00000000-0000-4000-8000-000000000501",
  leagueStage: "00000000-0000-4000-8000-000000000502",
};

async function seed() {
  await db.insert(countries).values({ id: ids.pakistan, iso2: "PK", name: "Pakistan", phoneCode: "+92" }).onConflictDoNothing();
  await db.insert(cities).values([
    { id: ids.karachi, countryId: ids.pakistan, name: "Karachi", regionName: "Sindh", timeZone: "Asia/Karachi" },
    { id: ids.lahore, countryId: ids.pakistan, name: "Lahore", regionName: "Punjab", timeZone: "Asia/Karachi" },
    { id: ids.islamabad, countryId: ids.pakistan, name: "Islamabad", regionName: "Islamabad Capital Territory", timeZone: "Asia/Karachi" },
  ]).onConflictDoNothing();

  const seededGames = [
    { id: ids.dota, slug: "dota-2", name: "Dota 2", genre: "MOBA", publisher: "Valve", teamSize: 5, coverGradient: "green" },
    { id: ids.valorant, slug: "valorant", name: "VALORANT", genre: "Tactical FPS", publisher: "Riot Games", teamSize: 5, coverGradient: "blue" },
    { id: ids.tekken, slug: "tekken-8", name: "Tekken 8", genre: "Fighting", publisher: "Bandai Namco", teamSize: 1, coverGradient: "pink" },
    { id: ids.pubg, slug: "pubg-mobile", name: "PUBG Mobile", genre: "Battle Royale", publisher: "Level Infinite", teamSize: 4, coverGradient: "amber" },
  ];
  await db.insert(games).values(seededGames).onConflictDoNothing();
  for (const game of seededGames) await db.update(games).set({ genre: game.genre }).where(eq(games.id, game.id));

  await db.insert(roles).values([
    { key: "super_admin", name: "Super Admin" },
    { key: "admin", name: "Admin" },
    { key: "tournament_operator", name: "Tournament Operator" },
    { key: "content_manager", name: "Content Manager" },
    { key: "gamer", name: "Gamer" },
    { key: "sponsor", name: "Sponsor Representative" },
  ]).onConflictDoNothing();

  const [superAdminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "super_admin")).limit(1);
  const [existingSuperAdminIdentity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, SUPERADMIN_EMAIL)))
    .limit(1);

  const superAdminUserId = existingSuperAdminIdentity?.userId ?? ids.superAdmin;
  await db.insert(users).values({ id: superAdminUserId, status: "active", acceptedTermsVersion: "2026-08" })
    .onConflictDoUpdate({ target: users.id, set: { status: "active" } });
  await db.insert(userIdentities).values({
    userId: superAdminUserId,
    type: "email",
    normalizedValue: SUPERADMIN_EMAIL,
    verifiedAt: new Date(),
  }).onConflictDoNothing();
  await db.insert(adminCredentials).values({
    userId: superAdminUserId,
    passwordHash: await hashPassword(SUPERADMIN_PASSWORD),
  }).onConflictDoUpdate({
    target: adminCredentials.userId,
    set: { passwordHash: await hashPassword(SUPERADMIN_PASSWORD), updatedAt: new Date() },
  });
  await db.insert(userRoles).values({ userId: superAdminUserId, roleId: superAdminRole.id, scopeType: "platform" }).onConflictDoNothing();

  await db.insert(permissions).values([
    { key: "platform.manage", description: "Manage platform settings and access" },
    { key: "tournament.manage", description: "Configure and operate tournaments" },
    { key: "match.result.write", description: "Report and finalize match results" },
    { key: "content.publish", description: "Publish homepage and editorial content" },
    { key: "identity.verify", description: "Verify gamers, teams, and sponsors" },
    { key: "audit.read", description: "Review audit events" },
  ]).onConflictDoNothing();

  await db.insert(sponsors).values([
    { slug: "vertex", name: "Vertex", category: "Technology", verificationStatus: "verified" },
    { slug: "pulse-energy", name: "Pulse Energy", category: "Beverage", verificationStatus: "verified" },
    { slug: "nexus-gear", name: "Nexus Gear", category: "Gaming Hardware", verificationStatus: "verified" },
  ]).onConflictDoNothing();

  await db.insert(tournaments).values({
    id: ids.national,
    slug: "national-championship-2026",
    name: "National Championship 2026",
    description: "Pakistan's flagship multi-stage Dota 2 championship.",
    status: "live",
    countryId: ids.pakistan,
    startsAt: new Date("2026-08-18T12:00:00+05:00"),
    endsAt: new Date("2026-08-24T22:00:00+05:00"),
    registrationClosesAt: new Date("2026-08-10T23:59:59+05:00"),
    online: false,
    featured: true,
  }).onConflictDoNothing();

  await db.insert(tournaments).values({
    id: ids.proLeague,
    slug: "pakistan-pro-league-2026",
    name: "Pakistan Pro League 2026",
    competitionType: "league",
    description: "A season-long Dota 2 league for Pakistan's leading players.",
    status: "completed",
    countryId: ids.pakistan,
    startsAt: new Date("2026-05-04T18:00:00+05:00"),
    endsAt: new Date("2026-07-26T22:00:00+05:00"),
    registrationClosesAt: new Date("2026-04-28T23:59:59+05:00"),
    online: true,
    featured: false,
  }).onConflictDoUpdate({ target: tournaments.id, set: { competitionType: "league" } });

  const [existingGamerIdentity] = await db.select({ userId: userIdentities.userId }).from(userIdentities)
    .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, DEMO_GAMER_PHONE)))
    .limit(1);
  const gamerUserId = existingGamerIdentity?.userId ?? ids.gamerUser;
  await db.insert(users).values({ id: gamerUserId, status: "active", acceptedTermsVersion: "2026-08" })
    .onConflictDoUpdate({ target: users.id, set: { acceptedTermsVersion: "2026-08" } });
  await db.insert(userIdentities).values({ userId: gamerUserId, type: "phone", normalizedValue: DEMO_GAMER_PHONE, verifiedAt: new Date() }).onConflictDoNothing();

  const [gamerRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "gamer")).limit(1);
  await db.insert(userRoles).values({ userId: gamerUserId, roleId: gamerRole.id, scopeType: "platform" }).onConflictDoNothing();

  const [existingProfile] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles).where(eq(gamerProfiles.userId, gamerUserId)).limit(1);
  const gamerProfileId = existingProfile?.id ?? ids.gamerProfile;
  await db.insert(gamerProfiles).values({
    id: gamerProfileId,
    userId: gamerUserId,
    slug: "nova",
    displayName: "Ayaan Khan",
    handle: "NOVA",
    bio: "Dota 2 competitor from Karachi, focused on disciplined team play and national events.",
    countryId: ids.pakistan,
    cityId: ids.karachi,
    profileVisibility: "public",
    verificationStatus: "verified",
    rankingPoints: 9820,
  }).onConflictDoNothing();
  await db.insert(gamerGames).values({ gamerId: gamerProfileId, gameId: ids.dota, inGameName: "NOVA", primaryRole: "Carry", platform: "PC", verified: true }).onConflictDoNothing();

  await db.insert(divisions).values([
    { id: ids.nationalDivision, tournamentId: ids.national, gameId: ids.dota, name: "Open Division", competitionType: "tournament", status: "live", participantType: "gamer", maxParticipants: 64, rosterMin: 1, rosterMax: 1 },
    { id: ids.leagueDivision, tournamentId: ids.proLeague, gameId: ids.dota, name: "Premier Division", competitionType: "league", status: "completed", participantType: "gamer", maxParticipants: 32, rosterMin: 1, rosterMax: 1 },
  ]).onConflictDoNothing();
  await db.insert(registrations).values([
    { divisionId: ids.nationalDivision, participantId: gamerProfileId, participantType: "gamer", displayNameSnapshot: "NOVA", seed: 4, checkedInAt: new Date("2026-08-18T10:00:00+05:00"), eligible: true },
    { divisionId: ids.leagueDivision, participantId: gamerProfileId, participantType: "gamer", displayNameSnapshot: "NOVA", seed: 2, checkedInAt: new Date("2026-05-04T16:00:00+05:00"), eligible: true },
  ]).onConflictDoNothing();
  await db.insert(stages).values([
    { id: ids.nationalStage, divisionId: ids.nationalDivision, name: "Championship standings", sequence: 1, format: "round_robin", status: "live", configuration: { pointsPerWin: 3 } },
    { id: ids.leagueStage, divisionId: ids.leagueDivision, name: "League table", sequence: 1, format: "round_robin", status: "completed", configuration: { pointsPerWin: 3 } },
  ]).onConflictDoNothing();
  await db.insert(standings).values([
    { stageId: ids.nationalStage, participantId: gamerProfileId, displayNameSnapshot: "NOVA", rank: 3, played: 9, wins: 7, draws: 0, losses: 2, points: 21, scoreFor: 16, scoreAgainst: 7 },
    { stageId: ids.leagueStage, participantId: gamerProfileId, displayNameSnapshot: "NOVA", rank: 1, played: 16, wins: 12, draws: 0, losses: 4, points: 36, scoreFor: 28, scoreAgainst: 13 },
  ]).onConflictDoNothing();

  // homepage_slides has no unique key, so guard by title to keep re-seeding idempotent.
  const [existingSlide] = await db.select({ id: homepageSlides.id }).from(homepageSlides)
    .where(eq(homepageSlides.title, "The arena belongs to the fearless.")).limit(1);
  if (!existingSlide) {
    await db.insert(homepageSlides).values({
      eyebrow: "National Championship 2026",
      title: "The arena belongs to the fearless.",
      summary: "Follow Pakistan's best teams through groups and a double-elimination playoff.",
      callToActionLabel: "View live bracket",
      callToActionUrl: "/tournaments/national-championship-2026",
      sequence: 1,
      published: true,
    });
  }
}

seed()
  .then(() => console.log("Database seeded."))
  .finally(() => sqlClient.end());
