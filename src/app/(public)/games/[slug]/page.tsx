import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { divisions } from "@/db/schema";
import { getGame } from "@/lib/game-data";
import { ManagedGameDetail } from "@/components/managed-game-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const game = await getGame((await params).slug);
  return { title: game?.name ?? "Game" };
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getGame(slug);
  if (!game) notFound();

  const [events] = await db.select({ value: count() }).from(divisions).where(eq(divisions.gameId, game.id));
  return <ManagedGameDetail game={game} events={Number(events?.value ?? 0)} />;
}
