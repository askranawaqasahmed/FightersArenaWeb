"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { gameVisual, useManagedGames } from "./managed-game-directory";

export function ManagedGameDetail({ slug }: { slug: string }) {
  const game = useManagedGames().find((item) => item.slug === slug && item.active);
  if (!game) return <div className="page-shell"><div className="container"><div className="card account-empty"><h1>Game not found</h1><p className="muted">This game is inactive or no longer exists in the catalog.</p><Link className="button button-secondary" href="/games">Back to games</Link></div></div></div>;
  const visual = gameVisual(game);
  const mark = game.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  return <div className="page-shell"><div className="container"><Link className="text-link" href="/games"><ArrowLeft size={14} /> All games</Link><section className={`game-detail-hero game-preview-${visual.preview}`} style={{ "--game-color": visual.accent, "--game-secondary": visual.secondary } as React.CSSProperties}><div><div className="eyebrow">{game.genre}</div><h1 className="page-title">{game.name}</h1><p className="lede">Configured for {game.participantMode === "both" ? "individual and team" : game.participantMode} competition. Supported roles: {game.roles || "not specified"}.</p></div><div className="game-detail-art" aria-hidden="true"><span>{visual.preview === "fighting" ? "VS" : mark}</span></div></section><div className="section-compact"><div className="stats-grid"><div className="stat"><div className="stat-value">{game.teamSize}</div><div className="stat-label">Default team size</div></div><div className="stat"><div className="stat-value">{game.participantMode === "both" ? "Both" : game.participantMode}</div><div className="stat-label">Participant mode</div></div><div className="stat"><div className="stat-value">ACTIVE</div><div className="stat-label">Catalog status</div></div><div className="stat"><div className="stat-value">0</div><div className="stat-label">Upcoming events</div></div></div></div><h2 className="section-title">Featured competitions</h2><div className="card panel muted">New competitions for this game will be announced soon.</div></div></div>;
}
