import "server-only";

import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { gamerGames, games } from "@/db/schema";

export type PublicGame = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  publisher: string | null;
  teamSize: number;
  coverGradient: string;
  imageUrl: string | null;
  players: number;
};

async function playerCounts() {
  const rows = await db.select({ gameId: gamerGames.gameId, value: count() })
    .from(gamerGames).groupBy(gamerGames.gameId);
  return new Map(rows.map((row) => [row.gameId, Number(row.value)]));
}

const selection = {
  id: games.id,
  slug: games.slug,
  name: games.name,
  genre: games.genre,
  publisher: games.publisher,
  teamSize: games.teamSize,
  coverGradient: games.coverGradient,
  imageUrl: games.imageUrl,
};

export async function getGames(includeInactive = false): Promise<PublicGame[]> {
  const rows = includeInactive
    ? await db.select({ ...selection, active: games.active }).from(games).orderBy(asc(games.name))
    : await db.select(selection).from(games).where(eq(games.active, true)).orderBy(asc(games.name));
  const counts = await playerCounts();
  return rows.map((row) => ({ ...row, players: counts.get(row.id) ?? 0 }));
}

export async function getGame(slug: string): Promise<PublicGame | null> {
  const [row] = await db.select(selection).from(games).where(eq(games.slug, slug)).limit(1);
  if (!row) return null;
  const counts = await playerCounts();
  return { ...row, players: counts.get(row.id) ?? 0 };
}

/** Admin listing: includes deactivated games so an operator can bring one back. */
export async function listAdminGames() {
  const rows = await db.select({ ...selection, active: games.active }).from(games).orderBy(asc(games.name));
  const counts = await playerCounts();
  return rows.map((row) => ({ ...row, players: counts.get(row.id) ?? 0 }));
}
