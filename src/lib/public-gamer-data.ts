import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cities,
  countries,
  divisions,
  gamerAchievements,
  gamerGames,
  gamerProfiles,
  games,
  registrations,
  sponsors,
  sponsorships,
  stages,
  standings,
  teamMemberships,
  teams,
  tournamentParticipantSnapshots,
  tournaments,
} from "@/db/schema";
import { isPodium, isTitle } from "@/lib/placement";

/** Only fully public profiles are exposed. "sponsors" visibility is not general-public. */
const publicVisibility = "public" as const;

export type PublicGamerSummary = {
  slug: string;
  handle: string;
  name: string;
  initials: string;
  city: string | null;
  country: string | null;
  countryIso2: string | null;
  game: string | null;
  points: number;
  rank: number;
  verified: boolean;
  avatarUrl: string | null;
};

export type PublicGamerEvent = {
  tournamentSlug: string;
  tournamentName: string;
  divisionName: string;
  gameName: string;
  competitionType: string;
  status: string;
  startsAt: string | null;
  rank: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
};

export type PublicGamerPlacement = {
  tournamentSlug: string;
  tournamentName: string;
  divisionName: string;
  gameName: string;
  competitionType: string;
  finalRank: number | null;
  placementLabel: string | null;
  year: number | null;
  datePrecision: string;
  capturedAt: string;
};

export type PublicGamerAchievement = {
  category: string;
  title: string;
  detail: string | null;
  gameName: string | null;
  yearLabel: string | null;
};

export type PublicGamerProfile = PublicGamerSummary & {
  bio: string | null;
  memberSince: number;
  games: Array<{ game: string; inGameName: string; primaryRole: string | null; platform: string | null; verified: boolean }>;
  totals: { events: number; played: number; wins: number; losses: number; titles: number; podiums: number };
  events: PublicGamerEvent[];
  placements: PublicGamerPlacement[];
  achievements: PublicGamerAchievement[];
  sponsors: Array<{ name: string; category: string | null; logoUrl: string | null }>;
  teams: Array<{ slug: string; name: string; tag: string; logoUrl: string | null; role: string; isLeader: boolean }>;
};

type DbExecutor = Pick<typeof db, "select">;

export function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const baseSelection = {
  id: gamerProfiles.id,
  slug: gamerProfiles.slug,
  handle: gamerProfiles.handle,
  displayName: gamerProfiles.displayName,
  bio: gamerProfiles.bio,
  avatarUrl: gamerProfiles.avatarUrl,
  rankingPoints: gamerProfiles.rankingPoints,
  verificationStatus: gamerProfiles.verificationStatus,
  createdAt: gamerProfiles.createdAt,
  city: cities.name,
  country: countries.name,
  countryIso2: countries.iso2,
};

/** Primary game per gamer, chosen deterministically so list and detail agree. */
async function primaryGames(gamerIds: string[], executor: DbExecutor) {
  if (gamerIds.length === 0) return new Map<string, string>();
  const rows = await executor
    .select({ gamerId: gamerGames.gamerId, game: games.name })
    .from(gamerGames)
    .innerJoin(games, eq(games.id, gamerGames.gameId))
    .where(inArray(gamerGames.gamerId, gamerIds))
    .orderBy(asc(games.name));
  const map = new Map<string, string>();
  for (const row of rows) if (!map.has(row.gamerId)) map.set(row.gamerId, row.game);
  return map;
}

/** Titles and podium finishes per gamer, read from the historical placement snapshots. */
async function careerRecords(gamerIds: string[], executor: DbExecutor) {
  const record = new Map<string, { titles: number; podiums: number }>();
  if (gamerIds.length === 0) return record;
  const rows = await executor
    .select({ gamerId: tournamentParticipantSnapshots.participantId, finalRank: tournamentParticipantSnapshots.finalRank })
    .from(tournamentParticipantSnapshots)
    .where(and(
      inArray(tournamentParticipantSnapshots.participantId, gamerIds),
      eq(tournamentParticipantSnapshots.participantType, "gamer"),
    ));
  for (const row of rows) {
    const entry = record.get(row.gamerId) ?? { titles: 0, podiums: 0 };
    if (isTitle(row.finalRank)) entry.titles += 1;
    if (isPodium(row.finalRank)) entry.podiums += 1;
    record.set(row.gamerId, entry);
  }
  return record;
}

export type CareerRecord = { titles: number; podiums: number };

const NO_RECORD: CareerRecord = { titles: 0, podiums: 0 };

/**
 * Ladder order. Operator-awarded ranking points lead; while those are level (they are
 * zero for everyone until an operator awards any) titles then podiums decide it, so a
 * newcomer never outranks a decorated player on alphabetical order alone.
 */
export function compareLadder(
  left: { rankingPoints: number; displayName: string; record?: CareerRecord },
  right: { rankingPoints: number; displayName: string; record?: CareerRecord },
): number {
  if (left.rankingPoints !== right.rankingPoints) return right.rankingPoints - left.rankingPoints;
  const leftRecord = left.record ?? NO_RECORD;
  const rightRecord = right.record ?? NO_RECORD;
  if (leftRecord.titles !== rightRecord.titles) return rightRecord.titles - leftRecord.titles;
  if (leftRecord.podiums !== rightRecord.podiums) return rightRecord.podiums - leftRecord.podiums;
  return left.displayName.localeCompare(right.displayName);
}

export async function getPublicGamers(executor: DbExecutor = db): Promise<PublicGamerSummary[]> {
  const rows = await executor
    .select(baseSelection)
    .from(gamerProfiles)
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
    .where(eq(gamerProfiles.profileVisibility, publicVisibility));

  const recordByGamer = await careerRecords(rows.map((row) => row.id), executor);
  const ranked = [...rows].sort((left, right) => compareLadder(
    { ...left, record: recordByGamer.get(left.id) },
    { ...right, record: recordByGamer.get(right.id) },
  ));

  const gameByGamer = await primaryGames(ranked.map((row) => row.id), executor);
  return ranked.map((row, index) => ({
    slug: row.slug,
    handle: row.handle,
    name: row.displayName,
    initials: initialsFor(row.displayName),
    city: row.city,
    country: row.country,
    countryIso2: row.countryIso2,
    game: gameByGamer.get(row.id) ?? null,
    points: row.rankingPoints,
    rank: index + 1,
    verified: row.verificationStatus === "verified",
    avatarUrl: row.avatarUrl,
  }));
}

export async function getPublicGamer(slug: string, executor: DbExecutor = db): Promise<PublicGamerProfile | null> {
  return getGamerProfileData(
    and(eq(gamerProfiles.slug, slug), eq(gamerProfiles.profileVisibility, publicVisibility)),
    executor,
  );
}

/** The signed-in member's own record: same aggregation, without the public-visibility gate. */
export async function getOwnGamerAnalytics(userId: string, executor: DbExecutor = db): Promise<PublicGamerProfile | null> {
  return getGamerProfileData(eq(gamerProfiles.userId, userId), executor);
}

async function getGamerProfileData(
  where: ReturnType<typeof eq> | ReturnType<typeof and>,
  executor: DbExecutor,
): Promise<PublicGamerProfile | null> {
  const [profile] = await executor
    .select(baseSelection)
    .from(gamerProfiles)
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
    .where(where)
    .limit(1);
  if (!profile) return null;

  // Dense rank across public profiles by ranking points.
  const [ahead] = await executor
    .select({ value: sql<number>`count(*)::int` })
    .from(gamerProfiles)
    .where(and(
      eq(gamerProfiles.profileVisibility, publicVisibility),
      gt(gamerProfiles.rankingPoints, profile.rankingPoints),
    ));

  const gameRows = await executor
    .select({
      game: games.name,
      inGameName: gamerGames.inGameName,
      primaryRole: gamerGames.primaryRole,
      platform: gamerGames.platform,
      verified: gamerGames.verified,
    })
    .from(gamerGames)
    .innerJoin(games, eq(games.id, gamerGames.gameId))
    .where(eq(gamerGames.gamerId, profile.id))
    .orderBy(asc(games.name));

  // Competitive record: registrations joined to the standings of each division's stages.
  // Mirrors the private dashboard aggregation, restricted to publicly visible tournaments.
  const eventRows = await executor
    .select({
      registrationId: registrations.id,
      divisionId: divisions.id,
      tournamentSlug: tournaments.slug,
      tournamentName: tournaments.name,
      competitionType: tournaments.competitionType,
      tournamentStatus: tournaments.status,
      startsAt: tournaments.startsAt,
      divisionName: divisions.name,
      gameName: games.name,
      rank: standings.rank,
      played: standings.played,
      wins: standings.wins,
      draws: standings.draws,
      losses: standings.losses,
      points: standings.points,
    })
    .from(registrations)
    .innerJoin(divisions, eq(divisions.id, registrations.divisionId))
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .leftJoin(stages, eq(stages.divisionId, divisions.id))
    .leftJoin(standings, and(eq(standings.stageId, stages.id), eq(standings.participantId, profile.id)))
    .where(and(
      eq(registrations.participantId, profile.id),
      eq(registrations.participantType, "gamer"),
      inArray(tournaments.status, ["published", "registration_open", "registration_closed", "live", "completed"]),
    ))
    .orderBy(desc(tournaments.startsAt));

  // One row per registration; a division with several stages contributes summed totals.
  const eventMap = new Map<string, PublicGamerEvent & { registrationId: string }>();
  for (const row of eventRows) {
    const existing = eventMap.get(row.registrationId);
    const next: PublicGamerEvent & { registrationId: string } = {
      registrationId: row.registrationId,
      tournamentSlug: row.tournamentSlug,
      tournamentName: row.tournamentName,
      divisionName: row.divisionName,
      gameName: row.gameName,
      competitionType: row.competitionType,
      status: row.tournamentStatus,
      startsAt: row.startsAt?.toISOString() ?? null,
      rank: existing?.rank && row.rank ? Math.min(existing.rank, row.rank) : existing?.rank ?? row.rank,
      played: (existing?.played ?? 0) + (row.played ?? 0),
      wins: (existing?.wins ?? 0) + (row.wins ?? 0),
      draws: (existing?.draws ?? 0) + (row.draws ?? 0),
      losses: (existing?.losses ?? 0) + (row.losses ?? 0),
      points: (existing?.points ?? 0) + (row.points ?? 0),
    };
    eventMap.set(row.registrationId, next);
  }
  const events: PublicGamerEvent[] = [...eventMap.values()].map((entry) => ({
    tournamentSlug: entry.tournamentSlug,
    tournamentName: entry.tournamentName,
    divisionName: entry.divisionName,
    gameName: entry.gameName,
    competitionType: entry.competitionType,
    status: entry.status,
    startsAt: entry.startsAt,
    rank: entry.rank,
    played: entry.played,
    wins: entry.wins,
    draws: entry.draws,
    losses: entry.losses,
    points: entry.points,
  }));

  const placementRows = await executor
    .select({
      divisionId: tournamentParticipantSnapshots.divisionId,
      tournamentSlug: tournaments.slug,
      tournamentName: tournaments.name,
      competitionType: tournaments.competitionType,
      startsAt: tournaments.startsAt,
      datePrecision: tournaments.datePrecision,
      divisionName: divisions.name,
      gameName: games.name,
      finalRank: tournamentParticipantSnapshots.finalRank,
      placementLabel: tournamentParticipantSnapshots.placementLabel,
      capturedAt: tournamentParticipantSnapshots.capturedAt,
    })
    .from(tournamentParticipantSnapshots)
    .innerJoin(tournaments, eq(tournaments.id, tournamentParticipantSnapshots.tournamentId))
    .innerJoin(divisions, eq(divisions.id, tournamentParticipantSnapshots.divisionId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .where(and(
      eq(tournamentParticipantSnapshots.participantId, profile.id),
      eq(tournamentParticipantSnapshots.participantType, "gamer"),
    ))
    .orderBy(sql`${tournaments.startsAt} desc nulls last`, desc(tournamentParticipantSnapshots.capturedAt));

  const achievementRows = await executor
    .select({
      category: gamerAchievements.category,
      title: gamerAchievements.title,
      detail: gamerAchievements.detail,
      gameName: games.name,
      yearLabel: gamerAchievements.yearLabel,
    })
    .from(gamerAchievements)
    .leftJoin(games, eq(games.id, gamerAchievements.gameId))
    .where(eq(gamerAchievements.gamerId, profile.id))
    .orderBy(asc(gamerAchievements.category), asc(gamerAchievements.sequence));

  const sponsorRows = await executor
    .select({ name: sponsors.name, category: sponsors.category, logoUrl: sponsors.logoUrl })
    .from(sponsorships)
    .innerJoin(sponsors, eq(sponsors.id, sponsorships.sponsorId))
    .where(and(
      eq(sponsorships.subjectType, "gamer"),
      eq(sponsorships.subjectId, profile.id),
      eq(sponsorships.public, true),
      inArray(sponsorships.status, ["accepted", "active"]),
    ));

  const teamRows = await executor
    .select({
      slug: teams.slug,
      name: teams.name,
      tag: teams.tag,
      logoUrl: teams.logoUrl,
      role: teamMemberships.role,
      isLeader: teamMemberships.isLeader,
    })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(
      eq(teamMemberships.gamerId, profile.id),
      eq(teamMemberships.status, "active"),
    ));

  const placements: PublicGamerPlacement[] = placementRows.map((row) => ({
    tournamentSlug: row.tournamentSlug,
    tournamentName: row.tournamentName,
    divisionName: row.divisionName,
    gameName: row.gameName,
    competitionType: row.competitionType,
    finalRank: row.finalRank,
    placementLabel: row.placementLabel,
    year: row.datePrecision === "unknown" ? null : row.startsAt?.getFullYear() ?? null,
    datePrecision: row.datePrecision,
    capturedAt: row.capturedAt.toISOString(),
  }));

  // Events and titles span both live competition records and imported historical placements.
  // A division counted from a registration must not be counted again from its snapshot.
  const base = events.reduce((carry, event) => ({
    events: carry.events + 1,
    played: carry.played + event.played,
    wins: carry.wins + event.wins,
    losses: carry.losses + event.losses,
    titles: carry.titles + (isTitle(event.rank) ? 1 : 0),
    podiums: carry.podiums + (isPodium(event.rank) ? 1 : 0),
  }), { events: 0, played: 0, wins: 0, losses: 0, titles: 0, podiums: 0 });

  const registeredDivisionIds = new Set(eventRows.map((row) => row.divisionId));
  const totals = placementRows.reduce((carry, row) => (
    registeredDivisionIds.has(row.divisionId)
      ? carry
      : {
        ...carry,
        events: carry.events + 1,
        titles: carry.titles + (isTitle(row.finalRank) ? 1 : 0),
        podiums: carry.podiums + (isPodium(row.finalRank) ? 1 : 0),
      }
  ), base);

  return {
    slug: profile.slug,
    handle: profile.handle,
    name: profile.displayName,
    initials: initialsFor(profile.displayName),
    city: profile.city,
    country: profile.country,
    countryIso2: profile.countryIso2,
    game: gameRows[0]?.game ?? null,
    points: profile.rankingPoints,
    rank: Number(ahead?.value ?? 0) + 1,
    verified: profile.verificationStatus === "verified",
    avatarUrl: profile.avatarUrl,
    bio: profile.bio,
    memberSince: profile.createdAt.getFullYear(),
    games: gameRows,
    totals,
    events,
    placements,
    achievements: achievementRows,
    sponsors: sponsorRows,
    teams: teamRows,
  };
}

/**
 * Resolve match/standings participant ids to public profile links.
 * Participant ids are polymorphic, so gamers and teams are looked up separately.
 */
export async function resolveParticipantLinks(
  participants: Array<{ id: string; type: "gamer" | "team" | null }>,
  executor: DbExecutor = db,
): Promise<Map<string, { kind: "gamer" | "team"; slug: string }>> {
  const links = new Map<string, { kind: "gamer" | "team"; slug: string }>();
  const gamerIds = participants.filter((entry) => entry.type === "gamer").map((entry) => entry.id);
  const teamIds = participants.filter((entry) => entry.type === "team").map((entry) => entry.id);
  if (gamerIds.length > 0) {
    const rows = await executor
      .select({ id: gamerProfiles.id, slug: gamerProfiles.slug })
      .from(gamerProfiles)
      .where(and(
        inArray(gamerProfiles.id, gamerIds),
        eq(gamerProfiles.profileVisibility, publicVisibility),
      ));
    for (const row of rows) links.set(row.id, { kind: "gamer", slug: row.slug });
  }
  if (teamIds.length > 0) {
    const rows = await executor
      .select({ id: teams.id, slug: teams.slug })
      .from(teams)
      .where(inArray(teams.id, teamIds));
    for (const row of rows) links.set(row.id, { kind: "team", slug: row.slug });
  }
  return links;
}
