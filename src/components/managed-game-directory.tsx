"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import type { PublicGame } from "@/lib/game-data";

const gameVisuals: Record<string, { accent: string; secondary: string; preview: string }> = {
  "kof-98-um": { accent: "#e52dff", secondary: "#33204d", preview: "fighting" },
  "street-fighter-6": { accent: "#1e90ff", secondary: "#19354d", preview: "fighting" },
  "fatal-fury-cotw": { accent: "#ffb020", secondary: "#3b301b", preview: "fighting" },
};

export function gameVisual(game: Pick<PublicGame, "slug" | "genre">) {
  if (gameVisuals[game.slug]) return gameVisuals[game.slug];
  const genre = game.genre.toLowerCase();
  const preview = genre.includes("fight") ? "fighting" : genre.includes("shooter") || genre.includes("fps") ? "tactical" : "generic";
  return { accent: "#1e90ff", secondary: "#19354d", preview };
}

function playerLabel(game: PublicGame) {
  if (game.players > 0) return `${game.players.toLocaleString()} ${game.players === 1 ? "player" : "players"}`;
  return game.teamSize > 1 ? `Team competition · ${game.teamSize} players` : "Individual competition";
}

function GameGrid({ games }: { games: PublicGame[] }) {
  return <div className="game-grid">{games.map((game) => {
    const mark = game.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    const visual = gameVisual(game);
    return <Link
      className={`game-card game-preview-${visual.preview}`}
      href={`/games/${game.slug}`}
      key={game.slug}
      style={{
        "--game-color": visual.accent,
        "--game-secondary": visual.secondary,
        ...(game.imageUrl ? { backgroundImage: `url(${game.imageUrl})` } : {}),
      } as React.CSSProperties}
    >
      {!game.imageUrl && <span className="game-preview-art" aria-hidden="true"><span>{visual.preview === "fighting" ? "VS" : mark}</span></span>}
      <span className="game-genre">{game.genre}</span>
      <span className="game-name">{game.name}</span>
      <span className="game-count">{playerLabel(game)}</span>
    </Link>;
  })}</div>;
}

export function ManagedGameGrid({ games }: { games: PublicGame[] }) {
  return <GameGrid games={games} />;
}

type ModeFilter = "all" | "team" | "individual";

export function ManagedGameDirectory({ games }: { games: PublicGame[] }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [genre, setGenre] = useState("all");
  const [teamSize, setTeamSize] = useState("all");

  const genres = [...new Set(games.map((game) => game.genre))].sort();
  const filteredGames = games.filter((game) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || `${game.name} ${game.genre} ${game.publisher ?? ""}`.toLowerCase().includes(search);
    // A game's participant mode is implied by its team size.
    const matchesMode = mode === "all" || (mode === "team" ? game.teamSize > 1 : game.teamSize === 1);
    const matchesTeamSize = teamSize === "all"
      || (teamSize === "solo" && game.teamSize === 1)
      || (teamSize === "small" && game.teamSize >= 2 && game.teamSize <= 4)
      || (teamSize === "large" && game.teamSize >= 5);
    return matchesSearch && matchesMode && matchesTeamSize && (genre === "all" || game.genre === genre);
  });

  return <>
    <div className="directory-filters" aria-label="Game directory filters">
      <label className="filter-search directory-search"><Search size={17} /><input className="input" aria-label="Search games" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games or genres" /></label>
      <div className="directory-filter-row">
        <select className="select filter-select" aria-label="Filter games by mode" value={mode} onChange={(event) => setMode(event.target.value as ModeFilter)}><option value="all">All participant modes</option><option value="team">Team</option><option value="individual">Individual</option></select>
        <select className="select filter-select" aria-label="Filter games by genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{genres.map((item) => <option value={item} key={item}>{item}</option>)}</select>
        <select className="select filter-select" aria-label="Filter games by team size" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}><option value="all">All team sizes</option><option value="solo">Solo</option><option value="small">2–4 players</option><option value="large">5+ players</option></select>
      </div>
    </div>
    {filteredGames.length > 0 ? <GameGrid games={filteredGames} /> : <div className="card account-empty compact"><h2>No games found</h2><p className="muted">Try another search, mode, or genre.</p></div>}
  </>;
}
