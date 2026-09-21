"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Gamepad2, Pencil, Plus, Power, Save, Search, X } from "lucide-react";
import { useState } from "react";
import { MediaUploadField } from "@/components/media-upload-field";
import type { PublicGame } from "@/lib/game-data";

export const gameGenres = ["Fighting", "MOBA", "Tactical FPS", "Battle Royale", "Sports", "Racing", "Strategy", "Card Game", "Other"] as const;

export type AdminGame = PublicGame & { active: boolean };

type GameForm = {
  id: string | null;
  slug: string;
  name: string;
  genre: string;
  publisher: string;
  teamSize: number;
  imageUrl: string | null;
  active: boolean;
};

const emptyForm: GameForm = { id: null, slug: "", name: "", genre: "Fighting", publisher: "", teamSize: 1, imageUrl: null, active: true };

export function GameCatalogManager({ games }: { games: AdminGame[] }) {
  const router = useRouter();
  const [form, setForm] = useState<GameForm>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [status, setStatus] = useState("all");

  const filteredGames = games.filter((game) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [game.name, game.slug, game.genre, game.publisher ?? ""].some((value) => value.toLowerCase().includes(search));
    return matchesSearch && (genre === "all" || game.genre === genre) && (status === "all" || (status === "active") === game.active);
  });

  function startEdit(game: AdminGame) {
    setError("");
    setForm({
      id: game.id,
      slug: game.slug,
      name: game.name,
      genre: game.genre,
      publisher: game.publisher ?? "",
      teamSize: game.teamSize,
      imageUrl: game.imageUrl,
      active: game.active,
    });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError("A game name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        genre: form.genre,
        publisher: form.publisher.trim() || null,
        teamSize: Number(form.teamSize) || 1,
        imageUrl: form.imageUrl,
        active: form.active,
      };
      const response = form.id
        ? await fetch(`/api/v1/admin/games/${form.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/v1/admin/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.errors?.[0]?.message ?? body.detail ?? "The game could not be saved.");
      setForm(undefined);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The game could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(game: AdminGame) {
    setError("");
    const response = await fetch(`/api/v1/admin/games/${game.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !game.active }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.detail ?? "The game could not be updated.");
      return;
    }
    router.refresh();
  }

  return <main className="admin-content">
    <div className="section-header">
      <div><h1 className="admin-heading">Games</h1><p className="admin-subtitle">Manage the game catalogue used by tournaments, player profiles and the public site.</p></div>
      <button className="button button-primary" type="button" onClick={() => { setForm(emptyForm); setError(""); }}><Plus size={15} /> Add game</button>
    </div>

    {error && <p className="form-message form-error" role="alert">{error}</p>}

    {form && (
      <section className="card panel entity-editor">
        <div className="section-header">
          <h2 className="panel-title"><Gamepad2 size={17} /> {form.id ? `Edit ${form.name || "game"}` : "New game"}</h2>
          <button className="button button-secondary button-small" type="button" onClick={() => setForm(undefined)}><X size={14} /> Cancel</button>
        </div>
        <div className="builder-grid">
          <label className="form-group"><span className="form-label">Game name</span><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="form-group"><span className="form-label">Address</span><input className="input" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="Generated from the name" /></label>
          <label className="form-group"><span className="form-label">Genre</span><select className="select" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>{gameGenres.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="form-group"><span className="form-label">Publisher</span><input className="input" value={form.publisher} onChange={(event) => setForm({ ...form, publisher: event.target.value })} /></label>
          <label className="form-group"><span className="form-label">Default team size</span><input className="input" type="number" min="1" max="10" value={form.teamSize} onChange={(event) => setForm({ ...form, teamSize: Number(event.target.value) })} /><span className="helper">1 is an individual game.</span></label>
          <label className="form-group"><span className="form-label">Listed</span><select className="select" value={form.active ? "active" : "inactive"} onChange={(event) => setForm({ ...form, active: event.target.value === "active" })}><option value="active">Active</option><option value="inactive">Hidden</option></select></label>
        </div>
        <div className="builder-grid" style={{ marginTop: 16 }}>
          <MediaUploadField
            purpose="game-image"
            label="Game image"
            accept="image/*"
            altText={form.name}
            onUploaded={(media) => setForm((current) => (current ? { ...current, imageUrl: media.url } : current))}
            onError={(uploadError) => setError(uploadError)}
          />
          <label className="form-group">
            <span className="form-label">Image address</span>
            <input className="input" value={form.imageUrl ?? ""} onChange={(event) => setForm({ ...form, imageUrl: event.target.value || null })} placeholder="Uploaded automatically, or paste a URL" />
          </label>
        </div>
        <button className="button button-primary" type="button" disabled={saving} onClick={save}><Save size={15} /> {saving ? "Saving…" : "Save game"}</button>
      </section>
    )}

    <div className="directory-filters" aria-label="Game catalog filters">
      <label className="filter-search directory-search"><Search size={17} /><input className="input" aria-label="Search games" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games, genres or publishers" /></label>
      <div className="directory-filter-row">
        <select className="select filter-select" aria-label="Filter games by genre" value={genre} onChange={(event) => setGenre(event.target.value)}><option value="all">All genres</option>{[...new Set(games.map((game) => game.genre))].sort().map((item) => <option key={item}>{item}</option>)}</select>
        <select className="select filter-select" aria-label="Filter games by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Hidden</option></select>
      </div>
    </div>

    <section className="card panel table-scroll">
      <table className="data-table">
        <thead><tr><th>Game</th><th>Genre</th><th>Publisher</th><th>Team size</th><th>Players</th><th>Status</th><th /></tr></thead>
        <tbody>{filteredGames.map((game) => <tr key={game.id}>
          <td><strong>{game.name}</strong><div className="muted">/{game.slug}</div></td>
          <td>{game.genre}</td>
          <td>{game.publisher ?? <span className="muted">—</span>}</td>
          <td>{game.teamSize}</td>
          <td>{game.players}</td>
          <td><span className={`status ${game.active ? "" : "danger"}`}>{game.active ? "ACTIVE" : "HIDDEN"}</span></td>
          <td><div className="header-actions">
            <Link className="button button-secondary button-small" href={`/games/${game.slug}`} aria-label={`View ${game.name}`}><Eye size={14} /> View</Link>
            <button className="button button-secondary button-small" type="button" onClick={() => startEdit(game)} aria-label={`Edit ${game.name}`}><Pencil size={14} /> Edit</button>
            <button className="button button-secondary button-small" type="button" onClick={() => toggleActive(game)} aria-label={`${game.active ? "Hide" : "Activate"} ${game.name}`}><Power size={14} /> {game.active ? "Hide" : "Activate"}</button>
          </div></td>
        </tr>)}</tbody>
      </table>
      {filteredGames.length === 0 && <div className="account-empty compact"><Gamepad2 className="green" /><h2>No games found</h2><p className="muted">{games.length === 0 ? "Add the first game to the catalogue." : "Change the search or filters."}</p></div>}
    </section>
  </main>;
}
