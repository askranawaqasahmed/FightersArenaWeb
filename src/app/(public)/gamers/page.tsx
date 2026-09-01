import { GamerDirectory } from "@/components/gamer-directory";
import { getPublicGamers } from "@/lib/public-gamer-data";

export const metadata = { title: "Gamer Rankings" };
export const dynamic = "force-dynamic";

export default async function GamersPage() {
  const gamers = await getPublicGamers();
  return (
    <div className="page-shell" id="rankings">
      <div className="container">
        <div className="eyebrow">Verified national ladder</div>
        <h1 className="page-title">Meet the players<br /><span className="green">changing the game.</span></h1>
        <p className="lede">Rankings combine verified event results and game-specific competitive points. Filter by city, title and season.</p>
        <GamerDirectory gamers={gamers} />
      </div>
    </div>
  );
}
