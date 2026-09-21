import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  countries,
  divisions,
  games,
  matchSides,
  matches,
  registrations,
  rounds,
  stageParticipants,
  stages,
  standings,
  tournamentParticipantSnapshots,
  tournaments,
} from "@/db/schema";
import { compareBracketMatchOrder } from "@/lib/bracket-match-order";
import { resolveParticipantLinks } from "@/lib/public-gamer-data";
import type { Bracket, SlotSource } from "@/domain/tournament-engine";

/** Statuses an operator has made public. Drafts, cancellations and archives stay hidden. */
export const publicTournamentStatuses = [
  "published",
  "registration_open",
  "registration_closed",
  "live",
  "completed",
] as const;

/** Competitions an operator has retired are never listed, even inside a public event. */
const hiddenDivisionStatuses = ["cancelled", "archived"] as const;

const activeRegistrationStatuses = ["registered", "confirmed"] as const;
const finishedMatchStatuses = ["final", "forfeit", "cancelled"] as const;

const statusLabels: Record<string, string> = {
  // A draft competition can appear inside a live event; "DRAFT" would read as unfinished
  // work to a spectator, so it is labelled by what it actually means to them.
  draft: "NOT STARTED",
  published: "UPCOMING",
  registration_open: "REGISTERING",
  registration_closed: "REGISTRATION CLOSED",
  live: "LIVE",
  completed: "COMPLETED",
};

const formatLabels: Record<string, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  round_robin: "Round Robin",
  custom: "Custom",
};

export function publicStatusLabel(status: string) {
  return statusLabels[status] ?? status.replace(/_/g, " ").toUpperCase();
}

export function publicFormatLabel(format: string | null) {
  return format ? formatLabels[format] ?? format : "Format to be announced";
}

/**
 * `precision` records how much of the date is actually known:
 *   "day"     a real scheduled date
 *   "year"    only the year is known (historical import)
 *   "unknown" the date was never recorded
 */
export function formatDateRange(startsAt: Date | null, endsAt: Date | null, precision: string = "day") {
  if (precision === "unknown") return "Date not recorded";
  if (startsAt && precision === "year") return String(startsAt.getFullYear());
  if (!startsAt) return "Dates to be announced";
  const start = startsAt.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
  if (!endsAt) return start;
  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  if (sameDay) return start;
  const sameYear = startsAt.getFullYear() === endsAt.getFullYear();
  const end = endsAt.toLocaleDateString("en-PK", sameYear
    ? { day: "2-digit", month: "short", year: "numeric" }
    : { day: "2-digit", month: "short", year: "numeric" });
  return `${startsAt.toLocaleDateString("en-PK", sameYear ? { day: "2-digit", month: "short" } : { day: "2-digit", month: "short", year: "numeric" })} – ${end}`;
}

export type PublicTournamentSummary = {
  id: string;
  slug: string;
  name: string;
  competitionType: string;
  status: string;
  statusLabel: string;
  game: string;
  games: string[];
  format: string;
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  country: string | null;
  online: boolean;
  featured: boolean;
  bannerUrl: string | null;
  hasBracket: boolean;
  youtubeUrl: string | null;
  datePrecision: string;
  teams: number;
  divisions: number;
  progress: number;
};

export type PublicDivisionSummary = {
  id: string;
  name: string;
  game: string;
  status: string;
  statusLabel: string;
  competitionType: string;
  participantType: string;
  format: string;
  formatLabel: string;
  stageName: string | null;
  bestOf: number | null;
  participants: number;
  placements: Array<{ displayName: string; finalRank: number | null; placementLabel: string | null; gamerSlug: string | null }>;
  totalMatches: number;
  finishedMatches: number;
  liveMatches: number;
  bracketAvailable: boolean;
};

export type PublicTournamentDetail = PublicTournamentSummary & {
  description: string | null;
  divisionList: PublicDivisionSummary[];
};

export type PublicMatchSide = {
  slot: number;
  participantId: string | null;
  name: string | null;
  seed: number | null;
  score: number;
  outcome: string | null;
  sourceMatchCode: string | null;
  sourceOutcome: string | null;
  /** "gamer" | "team" | null (null = an unresolved bracket slot). */
  participantType: "gamer" | "team" | null;
  /** Public profile slug when the participant has one, for linking from the bracket. */
  profileSlug: string | null;
};

export type PublicMatch = {
  id: string;
  code: string;
  matchNumber: number;
  status: string;
  bestOf: number;
  round: string;
  roundSequence: number;
  lane: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerParticipantId: string | null;
  sides: PublicMatchSide[];
};

export type PublicStanding = {
  rank: number;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
  participantType: "gamer" | "team" | null;
  profileSlug: string | null;
};

export type PublicBracketView = {
  tournament: { slug: string; name: string; status: string; statusLabel: string };
  division: PublicDivisionSummary;
  bracket: Bracket | null;
  matches: PublicMatch[];
  standings: PublicStanding[];
  version: string;
};

type DbExecutor = Pick<typeof db, "select">;

function progressPercent(finished: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((finished / total) * 100);
}

/** Aggregate participant and match counts keyed by tournament id. */
async function tournamentCounts(tournamentIds: string[], executor: DbExecutor) {
  if (tournamentIds.length === 0) {
    return { participants: new Map<string, number>(), total: new Map<string, number>(), finished: new Map<string, number>() };
  }
  const participantRows = await executor
    .select({ tournamentId: divisions.tournamentId, value: count() })
    .from(registrations)
    .innerJoin(divisions, eq(divisions.id, registrations.divisionId))
    .where(and(
      inArray(divisions.tournamentId, tournamentIds),
      inArray(registrations.status, [...activeRegistrationStatuses]),
    ))
    .groupBy(divisions.tournamentId);
  const totalRows = await executor
    .select({ tournamentId: divisions.tournamentId, value: count() })
    .from(matches)
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .innerJoin(divisions, eq(divisions.id, stages.divisionId))
    .where(inArray(divisions.tournamentId, tournamentIds))
    .groupBy(divisions.tournamentId);
  const finishedRows = await executor
    .select({ tournamentId: divisions.tournamentId, value: count() })
    .from(matches)
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .innerJoin(divisions, eq(divisions.id, stages.divisionId))
    .where(and(
      inArray(divisions.tournamentId, tournamentIds),
      inArray(matches.status, [...finishedMatchStatuses]),
    ))
    .groupBy(divisions.tournamentId);
  return {
    participants: new Map(participantRows.map((row) => [row.tournamentId, Number(row.value)])),
    total: new Map(totalRows.map((row) => [row.tournamentId, Number(row.value)])),
    finished: new Map(finishedRows.map((row) => [row.tournamentId, Number(row.value)])),
  };
}

export async function getPublicTournaments(executor: DbExecutor = db): Promise<PublicTournamentSummary[]> {
  const rows = await executor
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      name: tournaments.name,
      competitionType: tournaments.competitionType,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      endsAt: tournaments.endsAt,
      online: tournaments.online,
      featured: tournaments.featured,
      bannerUrl: tournaments.bannerUrl,
      hasBracket: tournaments.hasBracket,
      youtubeUrl: tournaments.youtubeUrl,
      datePrecision: tournaments.datePrecision,
      country: countries.name,
      divisionId: divisions.id,
      gameName: games.name,
      format: stages.format,
    })
    .from(tournaments)
    .leftJoin(countries, eq(countries.id, tournaments.countryId))
    .leftJoin(divisions, eq(divisions.tournamentId, tournaments.id))
    .leftJoin(games, eq(games.id, divisions.gameId))
    .leftJoin(stages, and(eq(stages.divisionId, divisions.id), eq(stages.sequence, 1)))
    .where(inArray(tournaments.status, [...publicTournamentStatuses]))
    .orderBy(sql`${tournaments.startsAt} desc nulls last`);

  const byTournament = new Map<string, { row: typeof rows[number]; games: Set<string>; formats: Set<string>; divisions: Set<string> }>();
  for (const row of rows) {
    const entry = byTournament.get(row.id) ?? { row, games: new Set<string>(), formats: new Set<string>(), divisions: new Set<string>() };
    if (row.gameName) entry.games.add(row.gameName);
    if (row.format) entry.formats.add(row.format);
    if (row.divisionId) entry.divisions.add(row.divisionId);
    byTournament.set(row.id, entry);
  }

  const counts = await tournamentCounts([...byTournament.keys()], executor);

  // Events recorded without a bracket have no registrations; count their snapshots instead.
  const snapshotCounts = byTournament.size > 0
    ? await executor
      .select({ tournamentId: tournamentParticipantSnapshots.tournamentId, value: count() })
      .from(tournamentParticipantSnapshots)
      .where(inArray(tournamentParticipantSnapshots.tournamentId, [...byTournament.keys()]))
      .groupBy(tournamentParticipantSnapshots.tournamentId)
    : [];
  const snapshotByTournament = new Map(snapshotCounts.map((row) => [row.tournamentId, Number(row.value)]));

  return [...byTournament.entries()].map(([id, entry]) => {
    const gameNames = [...entry.games];
    const formats = [...entry.formats];
    const total = counts.total.get(id) ?? 0;
    const finished = counts.finished.get(id) ?? 0;
    return {
      id,
      slug: entry.row.slug,
      name: entry.row.name,
      competitionType: entry.row.competitionType,
      status: entry.row.status,
      statusLabel: publicStatusLabel(entry.row.status),
      game: gameNames.length ? gameNames.join(", ") : "Game to be announced",
      games: gameNames,
      format: formats.length === 1
        ? publicFormatLabel(formats[0])
        : formats.length > 1
          ? "Multi-format event"
          : entry.row.hasBracket ? publicFormatLabel(null) : "Final result",
      date: formatDateRange(entry.row.startsAt, entry.row.endsAt, entry.row.datePrecision),
      startsAt: entry.row.startsAt?.toISOString() ?? null,
      endsAt: entry.row.endsAt?.toISOString() ?? null,
      country: entry.row.country,
      online: entry.row.online,
      featured: entry.row.featured,
      bannerUrl: entry.row.bannerUrl,
      hasBracket: entry.row.hasBracket,
      youtubeUrl: entry.row.youtubeUrl,
      datePrecision: entry.row.datePrecision,
      teams: counts.participants.get(id) || snapshotByTournament.get(id) || 0,
      divisions: entry.divisions.size,
      // A completed event with no matches is an imported result, not an unstarted one.
      progress: total === 0 && entry.row.status === "completed" ? 100 : progressPercent(finished, total),
    };
  });
}

async function getDivisionSummaries(tournamentId: string, executor: DbExecutor): Promise<PublicDivisionSummary[]> {
  const rows = await executor
    .select({
      id: divisions.id,
      name: divisions.name,
      status: divisions.status,
      competitionType: divisions.competitionType,
      participantType: divisions.participantType,
      gameName: games.name,
      stageId: stages.id,
      stageName: stages.name,
      stageStatus: stages.status,
      format: stages.format,
      configuration: stages.configuration,
    })
    .from(divisions)
    .innerJoin(games, eq(games.id, divisions.gameId))
    .leftJoin(stages, and(eq(stages.divisionId, divisions.id), eq(stages.sequence, 1)))
    .where(eq(divisions.tournamentId, tournamentId))
    .orderBy(asc(divisions.createdAt));

  // The parent tournament's status already gates public visibility, so every competition
  // inside a visible event is listed — a not-yet-started one simply has no bracket yet.
  // Only operator-retired competitions stay hidden.
  const publicDivisions = rows.filter((row) => !hiddenDivisionStatuses.includes(row.status as typeof hiddenDivisionStatuses[number]));
  if (publicDivisions.length === 0) return [];

  const stageIds = publicDivisions.map((row) => row.stageId).filter((id): id is string => Boolean(id));
  const matchRows = stageIds.length
    ? await executor
        .select({ stageId: matches.stageId, status: matches.status })
        .from(matches)
        .where(inArray(matches.stageId, stageIds))
    : [];
  const participantRows = await executor
    .select({ divisionId: registrations.divisionId, value: count() })
    .from(registrations)
    .where(and(
      inArray(registrations.divisionId, publicDivisions.map((row) => row.id)),
      inArray(registrations.status, [...activeRegistrationStatuses]),
    ))
    .groupBy(registrations.divisionId);
  const participantsByDivision = new Map(participantRows.map((row) => [row.divisionId, Number(row.value)]));

  // Imported historical results have no registrations; their participants live in the snapshots.
  const snapshotRows = await executor
    .select({
      divisionId: tournamentParticipantSnapshots.divisionId,
      participantId: tournamentParticipantSnapshots.participantId,
      displayName: tournamentParticipantSnapshots.displayName,
      finalRank: tournamentParticipantSnapshots.finalRank,
      placementLabel: tournamentParticipantSnapshots.placementLabel,
    })
    .from(tournamentParticipantSnapshots)
    .where(inArray(tournamentParticipantSnapshots.divisionId, publicDivisions.map((row) => row.id)));

  const gamerLinks = await resolveParticipantLinks(
    snapshotRows.map((row) => ({ id: row.participantId, type: "gamer" as const })),
    executor,
  );

  return publicDivisions.map((row) => {
    const stageMatches = row.stageId ? matchRows.filter((match) => match.stageId === row.stageId) : [];
    const finished = stageMatches.filter((match) => finishedMatchStatuses.includes(match.status as typeof finishedMatchStatuses[number])).length;
    const live = stageMatches.filter((match) => match.status === "live").length;
    const configuration = (row.configuration ?? {}) as { bestOf?: number };
    const divisionSnapshots = snapshotRows
      .filter((snapshot) => snapshot.divisionId === row.id)
      .sort((left, right) => (left.finalRank ?? 999) - (right.finalRank ?? 999));
    return {
      id: row.id,
      name: row.name,
      game: row.gameName,
      status: row.status,
      statusLabel: publicStatusLabel(row.status),
      competitionType: row.competitionType,
      participantType: row.participantType,
      format: row.format ?? "custom",
      formatLabel: row.format ? publicFormatLabel(row.format) : "Archived result",
      stageName: row.stageName,
      bestOf: configuration.bestOf ?? null,
      participants: participantsByDivision.get(row.id) ?? divisionSnapshots.length,
      totalMatches: stageMatches.length,
      finishedMatches: finished,
      liveMatches: live,
      // The bracket only exists once the operator starts the competition.
      bracketAvailable: stageMatches.length > 0,
      placements: divisionSnapshots.map((snapshot) => ({
        displayName: snapshot.displayName,
        finalRank: snapshot.finalRank,
        placementLabel: snapshot.placementLabel,
        gamerSlug: gamerLinks.get(snapshot.participantId)?.slug ?? null,
      })),
    };
  });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public routes accept either a slug or a tournament uuid; normalise to a slug. */
export async function resolvePublicSlug(idOrSlug: string, executor: DbExecutor = db): Promise<string | null> {
  if (!uuidPattern.test(idOrSlug)) return idOrSlug;
  const [row] = await executor
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(eq(tournaments.id, idOrSlug))
    .limit(1);
  return row?.slug ?? null;
}

/** Public routes accept either a slug or a tournament uuid; normalise to the uuid. */
export async function resolveTournamentId(idOrSlug: string, executor: DbExecutor = db): Promise<string | null> {
  const [row] = await executor
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(uuidPattern.test(idOrSlug) ? eq(tournaments.id, idOrSlug) : eq(tournaments.slug, idOrSlug))
    .limit(1);
  return row?.id ?? null;
}

export async function getPublicTournament(slug: string, executor: DbExecutor = db): Promise<PublicTournamentDetail | null> {
  const [event] = await executor
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      name: tournaments.name,
      description: tournaments.description,
      competitionType: tournaments.competitionType,
      status: tournaments.status,
      startsAt: tournaments.startsAt,
      endsAt: tournaments.endsAt,
      online: tournaments.online,
      featured: tournaments.featured,
      bannerUrl: tournaments.bannerUrl,
      hasBracket: tournaments.hasBracket,
      youtubeUrl: tournaments.youtubeUrl,
      datePrecision: tournaments.datePrecision,
      country: countries.name,
    })
    .from(tournaments)
    .leftJoin(countries, eq(countries.id, tournaments.countryId))
    .where(and(
      eq(tournaments.slug, slug),
      inArray(tournaments.status, [...publicTournamentStatuses]),
    ))
    .limit(1);
  if (!event) return null;

  const divisionList = await getDivisionSummaries(event.id, executor);
  const counts = await tournamentCounts([event.id], executor);
  const total = counts.total.get(event.id) ?? 0;
  const finished = counts.finished.get(event.id) ?? 0;
  const gameNames = [...new Set(divisionList.map((division) => division.game))];
  const formats = [...new Set(divisionList.map((division) => division.format))];

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description,
    competitionType: event.competitionType,
    status: event.status,
    statusLabel: publicStatusLabel(event.status),
    game: gameNames.length ? gameNames.join(", ") : "Game to be announced",
    games: gameNames,
    format: formats.length === 1 ? publicFormatLabel(formats[0]) : formats.length > 1 ? "Multi-format event" : publicFormatLabel(null),
    date: formatDateRange(event.startsAt, event.endsAt, event.datePrecision),
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    country: event.country,
    hasBracket: event.hasBracket,
    youtubeUrl: event.youtubeUrl,
    datePrecision: event.datePrecision,
    online: event.online,
    featured: event.featured,
    bannerUrl: event.bannerUrl,
    teams: counts.participants.get(event.id) ?? divisionList.reduce((sum, division) => sum + division.participants, 0),
    divisions: divisionList.length,
    // A completed event with no matches is an imported result, not an unstarted one.
    progress: total === 0 && event.status === "completed" ? 100 : progressPercent(finished, total),
    divisionList,
  };
}

/**
 * Public read of a started competition's bracket, match list and standings.
 * This is the public counterpart of the admin-only `getDivisionPreviewTx`: it reads the
 * persisted bracket without running start validation or exposing operator-only fields.
 */
export async function getPublicBracket(
  slug: string,
  divisionId: string | undefined,
  executor: DbExecutor = db,
): Promise<PublicBracketView | null> {
  const detail = await getPublicTournament(slug, executor);
  if (!detail) return null;
  const division = divisionId
    ? detail.divisionList.find((item) => item.id === divisionId)
    : detail.divisionList.find((item) => item.liveMatches > 0)
      ?? detail.divisionList.find((item) => item.bracketAvailable)
      ?? detail.divisionList[0];
  if (!division) return null;

  const [stage] = await executor
    .select({ id: stages.id, format: stages.format, configuration: stages.configuration })
    .from(stages)
    .where(and(eq(stages.divisionId, division.id), eq(stages.sequence, 1)))
    .limit(1);
  const emptyView: PublicBracketView = {
    tournament: { slug: detail.slug, name: detail.name, status: detail.status, statusLabel: detail.statusLabel },
    division,
    bracket: null,
    matches: [],
    standings: [],
    version: "empty",
  };
  if (!stage) return emptyView;

  const persistedRounds = await executor.select().from(rounds).where(eq(rounds.stageId, stage.id)).orderBy(asc(rounds.sequence));
  const persistedMatches = await executor.select().from(matches).where(eq(matches.stageId, stage.id)).orderBy(asc(matches.sequence));
  if (persistedMatches.length === 0) return emptyView;
  const persistedSides = await executor
    .select()
    .from(matchSides)
    .where(inArray(matchSides.matchId, persistedMatches.map((match) => match.id)));
  const entrants = await executor
    .select({
      participantId: stageParticipants.participantId,
      participantType: stageParticipants.participantType,
      seed: stageParticipants.seed,
    })
    .from(stageParticipants)
    .where(eq(stageParticipants.stageId, stage.id));
  const seedByParticipant = new Map(entrants.map((row) => [row.participantId, row.seed]));
  const typeByParticipant = new Map(entrants.map((row) => [row.participantId, row.participantType]));
  const profileLinks = await resolveParticipantLinks(
    entrants.map((row) => ({ id: row.participantId, type: row.participantType })),
    executor,
  );

  // Stable bracket-wide numbering, identical ordering to the operator portal.
  const numbered = [...persistedMatches].sort((left, right) => {
    const leftRound = persistedRounds.find((round) => round.id === left.roundId);
    const rightRound = persistedRounds.find((round) => round.id === right.roundId);
    return compareBracketMatchOrder(
      { roundSequence: leftRound?.sequence ?? 0, lane: leftRound?.bracketLane ?? "main", matchSequence: left.sequence },
      { roundSequence: rightRound?.sequence ?? 0, lane: rightRound?.bracketLane ?? "main", matchSequence: right.sequence },
    );
  });
  const matchNumberById = new Map(numbered.map((match, index) => [match.id, index + 1]));

  const sidesFor = (matchId: string) => persistedSides
    .filter((side) => side.matchId === matchId)
    .sort((left, right) => left.slot - right.slot);

  const matchList: PublicMatch[] = persistedMatches.map((match) => {
    const round = persistedRounds.find((item) => item.id === match.roundId);
    return {
      id: match.id,
      code: match.code,
      matchNumber: matchNumberById.get(match.id) ?? 0,
      status: match.status,
      bestOf: match.bestOf,
      round: round?.label ?? "Round",
      roundSequence: round?.sequence ?? 0,
      lane: round?.bracketLane ?? "main",
      startedAt: match.startedAt?.toISOString() ?? null,
      endedAt: match.endedAt?.toISOString() ?? null,
      winnerParticipantId: match.winnerParticipantId,
      sides: sidesFor(match.id).map((side) => ({
        slot: side.slot,
        participantId: side.participantId,
        name: side.displayNameSnapshot,
        seed: side.participantId ? seedByParticipant.get(side.participantId) ?? null : null,
        score: side.score,
        outcome: side.outcome,
        sourceMatchCode: side.sourceMatchCode,
        sourceOutcome: side.sourceOutcome,
        participantType: side.participantId ? typeByParticipant.get(side.participantId) ?? null : null,
        profileSlug: side.participantId ? profileLinks.get(side.participantId)?.slug ?? null : null,
      })),
    };
  });

  let bracket: Bracket | null = null;
  if (stage.format === "single_elimination" || stage.format === "double_elimination") {
    const configuration = (stage.configuration ?? {}) as { generatedBracketSize?: number; actualParticipantCount?: number };
    bracket = {
      format: stage.format,
      size: Number(configuration.generatedBracketSize ?? entrants.length),
      rounds: persistedRounds.map((round) => ({
        sequence: round.sequence,
        label: round.label,
        lane: round.bracketLane as "main" | "upper" | "lower" | "final",
        matches: persistedMatches.filter((match) => match.roundId === round.id).map((match) => ({
          code: match.code,
          round: round.sequence,
          lane: round.bracketLane as "main" | "upper" | "lower" | "final",
          bestOf: match.bestOf,
          slots: sidesFor(match.id).map((side) => {
            if (side.participantId) {
              return {
                type: "participant" as const,
                participant: {
                  id: side.participantId,
                  name: side.displayNameSnapshot ?? "Participant",
                  seed: seedByParticipant.get(side.participantId) ?? 0,
                },
              };
            }
            if (side.sourceMatchCode) {
              return {
                type: "match" as const,
                matchCode: side.sourceMatchCode,
                outcome: side.sourceOutcome === "loser" ? "loser" as const : "winner" as const,
              };
            }
            return { type: "bye" as const };
          }) as [SlotSource, SlotSource],
        })),
      })),
    };
  }

  const standingRows = (await executor
    .select({
      participantId: standings.participantId,
      rank: standings.rank,
      name: standings.displayNameSnapshot,
      played: standings.played,
      wins: standings.wins,
      draws: standings.draws,
      losses: standings.losses,
      points: standings.points,
      scoreFor: standings.scoreFor,
      scoreAgainst: standings.scoreAgainst,
    })
    .from(standings)
    .where(eq(standings.stageId, stage.id))
    .orderBy(asc(standings.rank)))
    .map(({ participantId, ...row }) => ({
      ...row,
      participantType: typeByParticipant.get(participantId) ?? null,
      profileSlug: profileLinks.get(participantId)?.slug ?? null,
    }));

  return {
    tournament: { slug: detail.slug, name: detail.name, status: detail.status, statusLabel: detail.statusLabel },
    division,
    bracket,
    matches: matchList,
    standings: standingRows,
    version: bracketVersion(matchList),
  };
}

/** Change detector so public bracket pollers can skip unchanged renders. */
export function bracketVersion(matchList: PublicMatch[]): string {
  return matchList
    .map((match) => `${match.code}:${match.status}:${match.sides.map((side) => `${side.score}${side.outcome ?? ""}`).join(",")}`)
    .join("|");
}
