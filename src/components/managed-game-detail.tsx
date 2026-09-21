import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { gameVisual } from "./managed-game-directory";
import type { PublicGame } from "@/lib/game-data";

export function ManagedGameDetail({ game, events }: { game: PublicGame; events: number }) {
  const visual = gameVisual(game);
  const mark = game.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  const mode = game.teamSize > 1 ? "team" : "individual";

  return <div className="page-shell"><div className="container">
    <Link className="text-link" href="/games"><ArrowLeft size={14} /> All games</Link>
    <section
      className={`game-detail-hero game-preview-${visual.preview}`}
      style={{
        "--game-color": visual.accent,
        "--game-secondary": visual.secondary,
        ...(game.imageUrl ? { backgroundImage: `linear-gradient(90deg, rgba(10,12,16,.88), rgba(10,12,16,.35)), url(${game.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
      } as React.CSSProperties}
    >
      <div>
        <div className="eyebrow">{game.genre}</div>
        <h1 className="page-title">{game.name}</h1>
        <p className="lede">
          {game.publisher ? `Published by ${game.publisher}. ` : ""}
          Configured for {mode} competition.
        </p>
      </div>
      {!game.imageUrl && <div className="game-detail-art" aria-hidden="true"><span>{visual.preview === "fighting" ? "VS" : mark}</span></div>}
    </section>
    <div className="section-compact"><div className="stats-grid">
      <div className="stat"><div className="stat-value">{game.players.toLocaleString()}</div><div className="stat-label">Registered players</div></div>
      <div className="stat"><div className="stat-value">{events}</div><div className="stat-label">Competitions</div></div>
      <div className="stat"><div className="stat-value">{game.teamSize}</div><div className="stat-label">Default team size</div></div>
      <div className="stat"><div className="stat-value">{mode === "team" ? "Team" : "Solo"}</div><div className="stat-label">Participant mode</div></div>
    </div></div>
    <h2 className="section-title">Competitions</h2>
    <div className="card panel muted">
      {events > 0
        ? <>Browse every competition for this game in the <Link className="text-link" href="/tournaments">tournament directory</Link>.</>
        : "New competitions for this game will be announced soon."}
    </div>
  </div></div>;
}
