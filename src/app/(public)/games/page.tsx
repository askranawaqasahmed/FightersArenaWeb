import { getGames } from "@/lib/game-data";
import { ManagedGameDirectory } from "@/components/managed-game-directory";

export const dynamic = "force-dynamic";

export const metadata = { title: "Games" };

export default async function GamesPage() {
  const games = await getGames();
  return <div className="page-shell"><div className="container"><div className="eyebrow">National game directory</div><h1 className="page-title">Every game.<br /><span className="green">Every competitor.</span></h1><p className="lede">Discover each competitive scene, the players shaping it and the next chance to enter the arena.</p><ManagedGameDirectory games={games} /></div></div>;
}
