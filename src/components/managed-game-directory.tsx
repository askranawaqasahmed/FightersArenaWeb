"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { defaultManagedGames, gameCatalogChangeEvent, gameCatalogStorageKey, type ManagedGame } from "./game-catalog-manager";
import { featuredGames } from "@/lib/demo-data";

const gameVisuals: Record<string, { accent: string; secondary: string; preview: string }> = {
  "dota-2": { accent: "#00c875", secondary: "#163f35", preview: "moba" },
  valorant: { accent: "#ff4655", secondary: "#241a2a", preview: "tactical" },
  "tekken-8": { accent: "#e52dff", secondary: "#33204d", preview: "fighting" },
  "pubg-mobile": { accent: "#ffb020", secondary: "#3b301b", preview: "battle" },
};

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(gameCatalogChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(gameCatalogChangeEvent, onStoreChange); };
}

function getSnapshot() {
  return window.localStorage.getItem(gameCatalogStorageKey) ?? "";
}

export function useManagedGames() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => { try { return snapshot ? JSON.parse(snapshot) as ManagedGame[] : defaultManagedGames; } catch { return defaultManagedGames; } }, [snapshot]);
}

export function gameVisual(game: Pick<ManagedGame, "slug" | "genre">) {
  if (gameVisuals[game.slug]) return gameVisuals[game.slug];
  const preview = game.genre.toLowerCase().includes("fight") ? "fighting" : game.genre.toLowerCase().includes("shooter") || game.genre.includes("FPS") ? "tactical" : "generic";
  return { accent: "#1e90ff", secondary: "#19354d", preview };
}

function GameGrid({ games }: { games: ManagedGame[] }) {
  return <div className="game-grid">{games.map((game) => {
    const demo = featuredGames.find((item) => item.slug === game.slug);
    const mark = game.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
    const visual = gameVisual(game);
    return <Link className={`game-card game-preview-${visual.preview}`} href={`/games/${game.slug}`} key={game.slug} style={{ "--game-color": visual.accent, "--game-secondary": visual.secondary } as React.CSSProperties}><span className="game-preview-art" aria-hidden="true"><span>{visual.preview === "fighting" ? "VS" : mark}</span></span><span className="game-genre">{game.genre}</span><span className="game-name">{game.name}</span><span className="game-count">{demo ? `${demo.players.toLocaleString()} active players` : `${game.participantMode} competition · team size ${game.teamSize}`}</span></Link>;
  })}</div>;
}

export function ManagedGameGrid() {
  return <GameGrid games={useManagedGames().filter((game) => game.active)} />;
}

type ModeFilter = "all" | "team" | "individual";

export function ManagedGameDirectory() {
  const games = useManagedGames().filter((game) => game.active);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [genre, setGenre] = useState("all");
  const [teamSize, setTeamSize] = useState("all");
  const genres = [...new Set(games.map((game) => game.genre))].sort();
  const filteredGames = games.filter((game) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || `${game.name} ${game.genre} ${game.roles}`.toLowerCase().includes(search);
    const matchesMode = mode === "all" || game.participantMode === "both" || game.participantMode === mode;
    const matchesTeamSize = teamSize === "all" || (teamSize === "solo" && game.teamSize === 1) || (teamSize === "small" && game.teamSize >= 2 && game.teamSize <= 4) || (teamSize === "large" && game.teamSize >= 5);
    return matchesSearch && matchesMode && matchesTeamSize && (genre === "all" || game.genre === genre);
  });

  return <>
    <div className="directory-filters" aria-label="Game directory filters">
      <label className="filter-search directory-search"><Search size={17} /><input className="input" aria-label="Search games" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games or genres" /></label>
      <div className="directory-filter-row"><select className="select filter-select" aria-label="Filter games by mode" value={mode} onChange={(event) => setMode(event.target.value as ModeFilter)}><option value="all">All participant modes</option><option value="team">Team</option><option value="individual">Individual</option></select><select className="select filter-select" aria-label="Filter games by genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{genres.map((item) => <option value={item} key={item}>{item}</option>)}</select><select className="select filter-select" aria-label="Filter games by team size" value={teamSize} onChange={(event) => setTeamSize(event.target.value)}><option value="all">All team sizes</option><option value="solo">Solo</option><option value="small">2–4 players</option><option value="large">5+ players</option></select></div>
    </div>
    {filteredGames.length > 0 ? <GameGrid games={filteredGames} /> : <div className="card account-empty compact"><h2>No games found</h2><p className="muted">Try another search, mode, or genre.</p></div>}
  </>;
}
