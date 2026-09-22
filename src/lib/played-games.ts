import { and, asc, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { divisions, gamerAchievements, games, registrations, tournamentParticipantSnapshots, tournaments } from "@/db/schema";

type DbExecutor = Pick<typeof db, "select">;

/**
 * The games a player is listed under. They are never entered by hand: a player
 * has a game because they competed in one of its tournaments or because a
 * career highlight names it. Rows repeat per source; `verified` is true for
 * tournament play and operator-verified highlights, so callers take the OR.
 */
export function playedGames(executor: DbExecutor = db) {
  const fromResults = executor.select({
    gamerId: sql<string>`${tournamentParticipantSnapshots.participantId}`.as("gamer_id"),
    gameId: sql<string>`${divisions.gameId}`.as("game_id"),
    verified: sql<boolean>`true`.as("verified"),
  })
    .from(tournamentParticipantSnapshots)
    .innerJoin(divisions, eq(divisions.id, tournamentParticipantSnapshots.divisionId))
    .where(eq(tournamentParticipantSnapshots.participantType, "gamer"));

  const fromRegistrations = executor.select({
    gamerId: sql<string>`${registrations.participantId}`.as("gamer_id"),
    gameId: sql<string>`${divisions.gameId}`.as("game_id"),
    verified: sql<boolean>`true`.as("verified"),
  })
    .from(registrations)
    .innerJoin(divisions, eq(divisions.id, registrations.divisionId))
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .where(and(
      eq(registrations.participantType, "gamer"),
      inArray(registrations.status, ["registered", "confirmed"]),
      notInArray(tournaments.status, ["draft", "cancelled"]),
    ));

  const fromHighlights = executor.select({
    gamerId: sql<string>`${gamerAchievements.gamerId}`.as("gamer_id"),
    gameId: sql<string>`${gamerAchievements.gameId}`.as("game_id"),
    verified: sql<boolean>`${gamerAchievements.verified}`.as("verified"),
  })
    .from(gamerAchievements)
    .where(isNotNull(gamerAchievements.gameId));

  return union(fromResults, fromRegistrations, fromHighlights).as("played_games");
}

export type PlayedGame = { gameId: string; game: string; gameSlug: string; verified: boolean };

/** Each player's games, alphabetical, one entry per game. */
export async function playedGamesByGamer(gamerIds: string[], executor: DbExecutor = db) {
  const byGamer = new Map<string, PlayedGame[]>();
  if (gamerIds.length === 0) return byGamer;
  const played = playedGames(executor);
  const rows = await executor.select({
    gamerId: played.gamerId,
    gameId: games.id,
    game: games.name,
    gameSlug: games.slug,
    verified: sql<boolean>`bool_or(${played.verified})`,
  })
    .from(played)
    .innerJoin(games, sql`${games.id} = ${played.gameId}`)
    .where(inArray(played.gamerId, gamerIds))
    .groupBy(played.gamerId, games.id, games.name, games.slug)
    .orderBy(asc(games.name));
  for (const { gamerId, ...entry } of rows) {
    const list = byGamer.get(gamerId) ?? [];
    list.push(entry);
    byGamer.set(gamerId, list);
  }
  return byGamer;
}
