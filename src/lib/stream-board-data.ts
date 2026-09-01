import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  cities,
  countries,
  divisions,
  gamerGames,
  gamerProfiles,
  games,
  matchSides,
  matches,
  rounds,
  stageParticipants,
  stages,
  standings,
  streamBoards,
  teams,
  tournaments,
} from "@/db/schema";

export type BoardSide = {
  slot: number;
  displayName: string | null;
  score: number;
  outcome: string | null;
  participantId: string | null;
  participantType: "gamer" | "team" | null;
  gamer: {
    slug: string;
    handle: string;
    avatarUrl: string | null;
    countryIso2: string | null;
    countryName: string | null;
    rankingPoints: number;
  } | null;
  team: {
    slug: string;
    name: string;
    tag: string;
    logoUrl: string | null;
    countryIso2: string | null;
    countryName: string | null;
  } | null;
  profile?: BoardFeatured | null;
};

export type BoardFeatured = {
  slot: number;
  participantType: "gamer" | "team";
  displayName: string | null;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  countryIso2: string | null;
  countryName: string | null;
  city: string | null;
  rankingPoints: number | null;
  games: Array<{ game: string; inGameName: string; primaryRole: string | null; platform: string | null }>;
  record: { played: number; wins: number; losses: number; points: number } | null;
  team: BoardSide["team"];
};

export type BoardState = {
  board: { number: number; assigned: boolean; featuredSlot: number | null; updatedAt: string | null };
  tournament: { name: string; slug: string } | null;
  division: { name: string } | null;
  game: { name: string } | null;
  match: {
    id: string;
    code: string;
    status: string;
    bestOf: number;
    round: { label: string; lane: string };
    startedAt: string | null;
    endedAt: string | null;
    updatedAt: string;
    winnerParticipantId: string | null;
  } | null;
  sides: BoardSide[];
  featured: BoardFeatured | null;
};

// Flat, dependency-free shape for external consumers (custom OBS overlays,
// desktop scoreboard apps). Everything a scoreboard needs in one object:
// name + score per player plus the full profile fields, no nested envelope.
export type SimpleBoardPlayer = {
  slot: number;
  name: string | null;
  score: number;
  outcome: string | null;
  winner: boolean;
  type: "gamer" | "team" | null;
  handle: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  rankingPoints: number | null;
  games: Array<{ game: string; inGameName: string; primaryRole: string | null; platform: string | null }>;
  record: { played: number; wins: number; losses: number; points: number } | null;
  team: { name: string; tag: string; logoUrl: string | null } | null;
};

export type SimpleBoard = {
  board: number;
  assigned: boolean;
  version: string;
  tournament: string | null;
  division: string | null;
  game: string | null;
  matchCode: string | null;
  round: string | null;
  lane: string | null;
  bestOf: number | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  featuredSlot: number | null;
  winnerSlot: number | null;
  players: SimpleBoardPlayer[];
};

export function toSimpleBoard(state: BoardState): SimpleBoard {
  const winnerSide = state.match?.winnerParticipantId
    ? state.sides.find((side) => side.participantId === state.match?.winnerParticipantId)
    : undefined;
  return {
    board: state.board.number,
    assigned: state.board.assigned,
    version: boardVersion(state),
    tournament: state.tournament?.name ?? null,
    division: state.division?.name ?? null,
    game: state.game?.name ?? null,
    matchCode: state.match?.code ?? null,
    round: state.match?.round.label ?? null,
    lane: state.match?.round.lane ?? null,
    bestOf: state.match?.bestOf ?? null,
    status: state.match?.status ?? null,
    startedAt: state.match?.startedAt ?? null,
    endedAt: state.match?.endedAt ?? null,
    featuredSlot: state.board.featuredSlot,
    winnerSlot: winnerSide?.slot ?? null,
    players: state.sides.map((side) => {
      const profile = side.profile ?? null;
      return {
        slot: side.slot,
        name: side.displayName,
        score: side.score,
        outcome: side.outcome,
        winner: Boolean(winnerSide && winnerSide.slot === side.slot),
        type: side.participantType,
        handle: profile?.handle ?? side.gamer?.handle ?? null,
        avatarUrl: profile?.avatarUrl ?? side.gamer?.avatarUrl ?? side.team?.logoUrl ?? null,
        countryCode: profile?.countryIso2 ?? side.gamer?.countryIso2 ?? side.team?.countryIso2 ?? null,
        country: profile?.countryName ?? side.gamer?.countryName ?? side.team?.countryName ?? null,
        city: profile?.city ?? null,
        bio: profile?.bio ?? null,
        rankingPoints: profile?.rankingPoints ?? side.gamer?.rankingPoints ?? null,
        games: profile?.games ?? [],
        record: profile?.record ?? null,
        team: side.team ? { name: side.team.name, tag: side.team.tag, logoUrl: side.team.logoUrl } : null,
      };
    }),
  };
}

export function boardVersion(state: BoardState): string {
  return [
    state.board.updatedAt ?? "0",
    state.board.featuredSlot ?? "-",
    state.match?.id ?? "none",
    state.match?.status ?? "-",
    state.match?.updatedAt ?? "0",
    state.sides.map((side) => `${side.slot}:${side.score}:${side.outcome ?? ""}`).join("|"),
  ].join("/");
}

type DbExecutor = Pick<typeof db, "select">;

export async function getBoardState(
  boardNumber: number,
  opts: { includeProfile?: boolean; slotOverride?: 1 | 2; allProfiles?: boolean } = {},
  executor: DbExecutor = db,
): Promise<BoardState> {
  const [board] = await executor.select().from(streamBoards).where(eq(streamBoards.number, boardNumber)).limit(1);
  const emptyState: BoardState = {
    board: {
      number: boardNumber,
      assigned: false,
      featuredSlot: board?.featuredSlot ?? null,
      updatedAt: board?.updatedAt.toISOString() ?? null,
    },
    tournament: null,
    division: null,
    game: null,
    match: null,
    sides: [],
    featured: null,
  };
  if (!board?.matchId) return emptyState;

  const [context] = await executor
    .select({
      matchId: matches.id,
      code: matches.code,
      status: matches.status,
      bestOf: matches.bestOf,
      startedAt: matches.startedAt,
      endedAt: matches.endedAt,
      updatedAt: matches.updatedAt,
      winnerParticipantId: matches.winnerParticipantId,
      stageId: matches.stageId,
      roundLabel: rounds.label,
      roundLane: rounds.bracketLane,
      divisionName: divisions.name,
      gameName: games.name,
      tournamentName: tournaments.name,
      tournamentSlug: tournaments.slug,
    })
    .from(matches)
    .innerJoin(rounds, eq(rounds.id, matches.roundId))
    .innerJoin(stages, eq(stages.id, matches.stageId))
    .innerJoin(divisions, eq(divisions.id, stages.divisionId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .where(eq(matches.id, board.matchId))
    .limit(1);
  if (!context) return emptyState;

  const sideRows = await executor
    .select()
    .from(matchSides)
    .where(eq(matchSides.matchId, context.matchId))
    .orderBy(asc(matchSides.slot));
  const participantIds = sideRows.map((side) => side.participantId).filter((id): id is string => Boolean(id));

  const typeRows = participantIds.length
    ? await executor
        .select({ participantId: stageParticipants.participantId, participantType: stageParticipants.participantType })
        .from(stageParticipants)
        .where(and(eq(stageParticipants.stageId, context.stageId), inArray(stageParticipants.participantId, participantIds)))
    : [];
  const typeByParticipant = new Map(typeRows.map((row) => [row.participantId, row.participantType]));

  const gamerIds = participantIds.filter((id) => typeByParticipant.get(id) === "gamer");
  const teamIds = participantIds.filter((id) => typeByParticipant.get(id) === "team");

  const gamerRows = gamerIds.length
    ? await executor
        .select({
          id: gamerProfiles.id,
          slug: gamerProfiles.slug,
          displayName: gamerProfiles.displayName,
          handle: gamerProfiles.handle,
          bio: gamerProfiles.bio,
          avatarUrl: gamerProfiles.avatarUrl,
          profileVisibility: gamerProfiles.profileVisibility,
          rankingPoints: gamerProfiles.rankingPoints,
          countryIso2: countries.iso2,
          countryName: countries.name,
          city: cities.name,
        })
        .from(gamerProfiles)
        .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
        .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
        .where(inArray(gamerProfiles.id, gamerIds))
    : [];
  const gamerById = new Map(gamerRows.map((row) => [row.id, row]));

  const teamRows = teamIds.length
    ? await executor
        .select({
          id: teams.id,
          slug: teams.slug,
          name: teams.name,
          tag: teams.tag,
          logoUrl: teams.logoUrl,
          countryIso2: countries.iso2,
          countryName: countries.name,
        })
        .from(teams)
        .leftJoin(countries, eq(countries.id, teams.countryId))
        .where(inArray(teams.id, teamIds))
    : [];
  const teamById = new Map(teamRows.map((row) => [row.id, row]));

  const sides: BoardSide[] = sideRows.map((side) => {
    const type = side.participantId ? typeByParticipant.get(side.participantId) ?? null : null;
    const gamer = type === "gamer" && side.participantId ? gamerById.get(side.participantId) ?? null : null;
    const team = type === "team" && side.participantId ? teamById.get(side.participantId) ?? null : null;
    return {
      slot: side.slot,
      displayName: side.displayNameSnapshot ?? gamer?.displayName ?? team?.name ?? null,
      score: side.score,
      outcome: side.outcome,
      participantId: side.participantId,
      participantType: type,
      gamer: gamer
        ? {
            slug: gamer.slug,
            handle: gamer.handle,
            avatarUrl: gamer.avatarUrl,
            countryIso2: gamer.countryIso2,
            countryName: gamer.countryName,
            rankingPoints: gamer.rankingPoints,
          }
        : null,
      team: team
        ? {
            slug: team.slug,
            name: team.name,
            tag: team.tag,
            logoUrl: team.logoUrl,
            countryIso2: team.countryIso2,
            countryName: team.countryName,
          }
        : null,
    };
  });

  const wantProfiles = Boolean(opts.includeProfile || opts.allProfiles);
  const profileBySlot = new Map<number, BoardFeatured | null>();
  if (wantProfiles) {
    const gameRowsAll = gamerIds.length
      ? await executor
          .select({
            gamerId: gamerGames.gamerId,
            game: games.name,
            inGameName: gamerGames.inGameName,
            primaryRole: gamerGames.primaryRole,
            platform: gamerGames.platform,
          })
          .from(gamerGames)
          .innerJoin(games, eq(games.id, gamerGames.gameId))
          .where(inArray(gamerGames.gamerId, gamerIds))
      : [];
    const gamesByGamer = new Map<string, BoardFeatured["games"]>();
    for (const row of gameRowsAll) {
      const list = gamesByGamer.get(row.gamerId) ?? [];
      list.push({ game: row.game, inGameName: row.inGameName, primaryRole: row.primaryRole, platform: row.platform });
      gamesByGamer.set(row.gamerId, list);
    }
    const recordRows = participantIds.length
      ? await executor
          .select({
            participantId: standings.participantId,
            played: standings.played,
            wins: standings.wins,
            losses: standings.losses,
            points: standings.points,
          })
          .from(standings)
          .where(and(eq(standings.stageId, context.stageId), inArray(standings.participantId, participantIds)))
      : [];
    const recordByParticipant = new Map(recordRows.map((row) => [
      row.participantId,
      { played: row.played, wins: row.wins, losses: row.losses, points: row.points },
    ]));

    const buildProfile = (slot: number): BoardFeatured | null => {
      const side = sideRows.find((row) => row.slot === slot);
      if (!side?.participantId) return null;
      const type = typeByParticipant.get(side.participantId) ?? null;
      const record = recordByParticipant.get(side.participantId) ?? null;
      if (type === "gamer") {
        const gamer = gamerById.get(side.participantId);
        if (gamer) {
          const isPublic = gamer.profileVisibility === "public";
          return {
            slot,
            participantType: "gamer",
            displayName: side.displayNameSnapshot ?? gamer.displayName,
            handle: gamer.handle,
            avatarUrl: gamer.avatarUrl,
            bio: isPublic ? gamer.bio : null,
            countryIso2: gamer.countryIso2,
            countryName: gamer.countryName,
            city: isPublic ? gamer.city : null,
            rankingPoints: gamer.rankingPoints,
            games: gamesByGamer.get(gamer.id) ?? [],
            record,
            team: null,
          };
        }
      } else if (type === "team") {
        const team = teamById.get(side.participantId);
        if (team) {
          return {
            slot,
            participantType: "team",
            displayName: side.displayNameSnapshot ?? team.name,
            handle: team.tag,
            avatarUrl: team.logoUrl,
            bio: null,
            countryIso2: team.countryIso2,
            countryName: team.countryName,
            city: null,
            rankingPoints: null,
            games: [],
            record,
            team: {
              slug: team.slug,
              name: team.name,
              tag: team.tag,
              logoUrl: team.logoUrl,
              countryIso2: team.countryIso2,
              countryName: team.countryName,
            },
          };
        }
      }
      // Rehearsal/dummy entrants have no gamerProfiles or teams row — fall back to
      // the snapshot name so profile consumers still get the featured player.
      return {
        slot,
        participantType: type ?? "gamer",
        displayName: side.displayNameSnapshot,
        handle: null,
        avatarUrl: null,
        bio: null,
        countryIso2: null,
        countryName: null,
        city: null,
        rankingPoints: null,
        games: [],
        record,
        team: null,
      };
    };
    for (const side of sideRows) profileBySlot.set(side.slot, buildProfile(side.slot));
    if (opts.allProfiles) {
      for (const side of sides) side.profile = profileBySlot.get(side.slot) ?? null;
    }
  }

  const featuredSlot = opts.slotOverride ?? board.featuredSlot ?? 1;
  const featured = opts.includeProfile ? profileBySlot.get(featuredSlot) ?? null : null;

  return {
    board: {
      number: boardNumber,
      assigned: true,
      featuredSlot: board.featuredSlot,
      updatedAt: board.updatedAt.toISOString(),
    },
    tournament: { name: context.tournamentName, slug: context.tournamentSlug },
    division: { name: context.divisionName },
    game: { name: context.gameName },
    match: {
      id: context.matchId,
      code: context.code,
      status: context.status,
      bestOf: context.bestOf,
      round: { label: context.roundLabel, lane: context.roundLane },
      startedAt: context.startedAt?.toISOString() ?? null,
      endedAt: context.endedAt?.toISOString() ?? null,
      updatedAt: context.updatedAt.toISOString(),
      winnerParticipantId: context.winnerParticipantId,
    },
    sides,
    featured,
  };
}
