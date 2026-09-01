"use client";

import Link from "next/link";
import { Eye, Gamepad2, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { featuredGames } from "@/lib/demo-data";

export const gameCatalogStorageKey = "fighters-arena:game-catalog";
export const gameCatalogChangeEvent = "fighters-arena:game-catalog-change";
export const gameGenres = ["MOBA", "Tactical FPS", "Fighting", "Battle Royale", "Sports", "Racing", "Strategy", "Card Game", "Other"] as const;

export type ManagedGame = {
  slug: string;
  name: string;
  genre: string;
  participantMode: "individual" | "team" | "both";
  teamSize: number;
  roles: string;
  active: boolean;
};

export const defaultManagedGames: ManagedGame[] = featuredGames.map((game) => ({ slug: game.slug, name: game.name, genre: game.genre, participantMode: game.slug === "tekken-8" ? "individual" : "both", teamSize: game.slug === "valorant" ? 5 : game.slug === "dota-2" ? 5 : 1, roles: game.slug === "dota-2" ? "Carry, Mid, Offlane, Support" : game.slug === "valorant" ? "Duelist, Initiator, Controller, Sentinel" : "Player", active: true }));

const emptyGame: ManagedGame = { slug: "", name: "", genre: "Other", participantMode: "both", teamSize: 1, roles: "", active: true };

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(gameCatalogChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(gameCatalogChangeEvent, onStoreChange); };
}

function getSnapshot() {
  return window.localStorage.getItem(gameCatalogStorageKey) ?? "";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function GameCatalogManager() {
  const storedGames = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const games = useMemo(() => {
    try { return storedGames ? JSON.parse(storedGames) as ManagedGame[] : defaultManagedGames; } catch { return defaultManagedGames; }
  }, [storedGames]);
  const [editingSlug, setEditingSlug] = useState<string>();
  const [form, setForm] = useState<ManagedGame>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredGames = games.filter((game) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [game.name, game.slug, game.genre, game.roles].some((value) => value.toLowerCase().includes(search));
    return matchesSearch && (genre === "all" || game.genre === genre) && (mode === "all" || game.participantMode === mode || game.participantMode === "both") && (status === "all" || (status === "active") === game.active);
  });

  function persist(nextGames: ManagedGame[]) {
    window.localStorage.setItem(gameCatalogStorageKey, JSON.stringify(nextGames));
    window.dispatchEvent(new Event(gameCatalogChangeEvent));
  }

  function startCreate() {
    setEditingSlug(undefined);
    setForm(emptyGame);
    setError("");
  }

  function startEdit(game: ManagedGame) {
    setEditingSlug(game.slug);
    setForm({ ...game });
    setError("");
  }

  function saveGame() {
    if (!form?.name.trim() || !form.genre.trim()) { setError("Game name and genre are required."); return; }
    const slug = slugify(form.slug || form.name);
    if (!slug) { setError("Enter a valid game slug."); return; }
    if (games.some((game) => game.slug === slug && game.slug !== editingSlug)) { setError("A game already uses this slug."); return; }
    const savedGame = { ...form, slug, teamSize: Math.max(1, form.teamSize) };
    persist(editingSlug ? games.map((game) => game.slug === editingSlug ? savedGame : game) : [...games, savedGame]);
    setForm(undefined);
    setEditingSlug(undefined);
  }

  function deleteGame(game: ManagedGame) {
    if (!window.confirm(`Delete ${game.name} from the game catalog?`)) return;
    persist(games.filter((item) => item.slug !== game.slug));
    if (editingSlug === game.slug) setForm(undefined);
  }

  return (
    <main className="admin-content">
      <div className="section-header"><div><h1 className="admin-heading">Game catalog</h1><p className="admin-subtitle">Create, edit, activate, and remove games used by events and public discovery.</p></div><button className="button button-primary" type="button" onClick={startCreate}><Plus size={16} /> Add game</button></div>
      {form && <section className="card panel entity-editor"><div className="section-header stage-header"><h2 className="panel-title">{editingSlug ? "Edit game" : "Create game"}</h2><button className="button button-secondary button-small" type="button" onClick={() => setForm(undefined)}><X size={14} /> Cancel</button></div>{error && <p className="form-message form-error" role="alert">{error}</p>}<div className="builder-grid"><label className="form-group"><span className="form-label">Game name</span><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value, slug: editingSlug ? form.slug : slugify(event.target.value) })} /></label><label className="form-group"><span className="form-label">Slug</span><input className="input" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></label><label className="form-group"><span className="form-label">Genre</span><select className="select" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>{!gameGenres.includes(form.genre as typeof gameGenres[number]) && <option value={form.genre}>{form.genre}</option>}{gameGenres.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label className="form-group"><span className="form-label">Participant mode</span><select className="select" value={form.participantMode} onChange={(event) => setForm({ ...form, participantMode: event.target.value as ManagedGame["participantMode"] })}><option value="individual">Individual</option><option value="team">Team</option><option value="both">Individual and team</option></select></label><label className="form-group"><span className="form-label">Default team size</span><input className="input" type="number" min="1" value={form.teamSize} onChange={(event) => setForm({ ...form, teamSize: Number(event.target.value) })} /></label><label className="form-group"><span className="form-label">Roles</span><input className="input" value={form.roles} placeholder="Carry, Support, Coach" onChange={(event) => setForm({ ...form, roles: event.target.value })} /></label></div><label className="player-assignment" style={{ marginTop: 18 }}><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span>Active and available for new event competitions</span></label><button className="button button-primary" type="button" style={{ marginTop: 20 }} onClick={saveGame}><Save size={15} /> Save game</button></section>}
      <div className="directory-filters" aria-label="Game catalog filters"><label className="filter-search directory-search"><Search size={17} /><input className="input" aria-label="Search game catalog" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games, genres, or roles" /></label><div className="directory-filter-row"><select className="select filter-select" aria-label="Filter by genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{[...new Set(games.map((game) => game.genre))].sort().map((item) => <option value={item} key={item}>{item}</option>)}</select><select className="select filter-select" aria-label="Filter by participant mode" value={mode} onChange={(event) => setMode(event.target.value)}><option value="all">All participant modes</option><option value="team">Team</option><option value="individual">Individual</option></select><select className="select filter-select" aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>
      <section className="card panel table-scroll"><table className="data-table"><thead><tr><th>Game</th><th>Genre</th><th>Mode</th><th>Team size</th><th>Roles</th><th>Status</th><th /></tr></thead><tbody>{filteredGames.map((game) => <tr key={game.slug}><td><strong><Gamepad2 className="green" size={15} /> {game.name}</strong><div className="muted">/{game.slug}</div></td><td>{game.genre}</td><td>{game.participantMode}</td><td>{game.teamSize}</td><td>{game.roles || "Not configured"}</td><td><span className={`status ${game.active ? "" : "pending"}`}>{game.active ? "ACTIVE" : "INACTIVE"}</span></td><td><div className="header-actions"><Link className="button button-secondary button-small" href={`/games/${game.slug}`} aria-label={`View ${game.name}`}><Eye size={14} /> View</Link><button className="button button-secondary button-small" type="button" onClick={() => startEdit(game)} aria-label={`Edit ${game.name}`}><Pencil size={14} /> Edit</button><button className="button button-secondary button-small" type="button" onClick={() => deleteGame(game)} aria-label={`Delete ${game.name}`}><Trash2 size={14} /> Delete</button></div></td></tr>)}</tbody></table>{filteredGames.length === 0 && <div className="account-empty compact"><Gamepad2 className="green" /><h2>No games found</h2><p className="muted">Change the search or filters to see catalog entries.</p></div>}</section>
    </main>
  );
}
