"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { achievementCategories, achievementCategoryLabels, type AchievementCategory } from "@/lib/achievement-labels";

type Option = { id: string; name: string };
type GameRow = { gameId: string; game: string };
type AchievementRow = { category: AchievementCategory; title: string; detail: string; gameId: string; yearLabel: string };

export type AdminGamerEditorData = {
  slug: string;
  displayName: string;
  handle: string;
  bio: string | null;
  cityId: string | null;
  profileVisibility: "private" | "sponsors" | "public";
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  rankingPoints: number;
  games: GameRow[];
  achievements: AchievementRow[];
};

export function AdminGamerEditor({ gamer, gameOptions, cityOptions }: {
  gamer: AdminGamerEditorData;
  gameOptions: Option[];
  cityOptions: Option[];
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(gamer.displayName);
  const [handle, setHandle] = useState(gamer.handle);
  const [bio, setBio] = useState(gamer.bio ?? "");
  const [cityId, setCityId] = useState(gamer.cityId ?? "");
  const [visibility, setVisibility] = useState(gamer.profileVisibility);
  const [verification, setVerification] = useState(gamer.verificationStatus);
  const [points, setPoints] = useState(gamer.rankingPoints);
  const [achievements, setAchievements] = useState<AchievementRow[]>(gamer.achievements);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateAchievement(index: number, patch: Partial<AchievementRow>) {
    setAchievements((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (!displayName.trim() || !handle.trim()) {
      setError("A display name and gamer tag are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/gamers/${encodeURIComponent(gamer.slug)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          handle: handle.trim(),
          bio: bio.trim() === "" ? null : bio.trim(),
          cityId: cityId === "" ? null : cityId,
          profileVisibility: visibility,
          verificationStatus: verification,
          rankingPoints: Number(points) || 0,
          achievements: achievements
            .filter((row) => row.title.trim() !== "")
            .map((row) => ({
              category: row.category,
              title: row.title.trim(),
              detail: row.detail.trim() === "" ? null : row.detail.trim(),
              gameId: row.gameId === "" ? null : row.gameId,
              yearLabel: row.yearLabel.trim() === "" ? null : row.yearLabel.trim(),
            })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.errors?.[0]?.message ?? body.detail ?? "The gamer could not be saved.");
      router.replace(`/admin/gamers/${gamer.slug}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The gamer could not be saved.");
      setSaving(false);
    }
  }

  return <main className="admin-content admin-editor-content">
    <Link className="text-link" href={`/admin/gamers/${gamer.slug}`}><ArrowLeft size={14} /> Gamer details</Link>
    <div className="section-header" style={{ marginTop: 18 }}>
      <div><h1 className="admin-heading">Edit {gamer.handle}</h1><p className="admin-subtitle">Update identity, career highlights and verification.</p></div>
      <button className="button button-primary" type="button" disabled={saving} onClick={save}><Save size={15} /> {saving ? "Saving…" : "Save gamer"}</button>
    </div>
    {error && <p className="form-message form-error" role="alert">{error}</p>}

    <section className="card panel entity-editor">
      <h2 className="panel-title">Profile identity</h2>
      <div className="builder-grid">
        <label className="form-group"><span className="form-label">Display name</span><input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="form-group"><span className="form-label">Gamer tag</span><input className="input" value={handle} onChange={(event) => setHandle(event.target.value)} /></label>
        <label className="form-group"><span className="form-label">City</span><select className="select" value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">Not set</option>{cityOptions.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
        <label className="form-group"><span className="form-label">Ranking points</span><input className="input" type="number" min="0" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></label>
        <label className="form-group"><span className="form-label">Verification</span><select className="select" value={verification} onChange={(event) => setVerification(event.target.value as AdminGamerEditorData["verificationStatus"])}><option value="verified">Verified</option><option value="pending">Pending</option><option value="unverified">Unverified</option><option value="rejected">Rejected</option></select></label>
        <label className="form-group"><span className="form-label">Profile visibility</span><select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value as AdminGamerEditorData["profileVisibility"])}><option value="public">Public</option><option value="sponsors">Sponsors only</option><option value="private">Private</option></select></label>
      </div>
      <label className="form-group" style={{ marginTop: 18 }}><span className="form-label">Biography</span><textarea className="textarea" value={bio} onChange={(event) => setBio(event.target.value)} /></label>
      <p className="helper">Blocking an account and resetting a password are on the gamer details page.</p>
    </section>

    <section className="card panel entity-editor">
      <h2 className="panel-title">Games</h2>
      <p className="helper">Games come from the tournaments this player has played and the games on their career highlights. To list another game, add a highlight for it below.</p>
      {gamer.games.length > 0
        ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{gamer.games.map((entry) => <span className="filter-chip static" key={entry.gameId}>{entry.game}</span>)}</div>
        : <p className="muted">No games yet.</p>}
    </section>

    <section className="card panel entity-editor">
      <h2 className="panel-title">Career highlights</h2>
      <p className="helper">Tournament results come from the events themselves. Everything else goes here.</p>
      {achievements.map((row, index) => (
        <div className="builder-grid" key={`achievement-${index}`}>
          <label className="form-group"><span className="form-label">Type</span>
            <select className="select" value={row.category} onChange={(event) => updateAchievement(index, { category: event.target.value as AchievementCategory })}>
              {achievementCategories.map((category) => <option key={category} value={category}>{achievementCategoryLabels[category]}</option>)}
            </select>
          </label>
          <label className="form-group"><span className="form-label">Title</span><input className="input" value={row.title} onChange={(event) => updateAchievement(index, { title: event.target.value })} /></label>
          <label className="form-group"><span className="form-label">Detail</span><input className="input" value={row.detail} onChange={(event) => updateAchievement(index, { detail: event.target.value })} /></label>
          <label className="form-group"><span className="form-label">Game</span>
            <select className="select" value={row.gameId} onChange={(event) => updateAchievement(index, { gameId: event.target.value })}>
              <option value="">Not specific</option>
              {gameOptions.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
            </select>
          </label>
          <label className="form-group"><span className="form-label">Year</span><input className="input" value={row.yearLabel} onChange={(event) => updateAchievement(index, { yearLabel: event.target.value })} placeholder="2014–2019" /></label>
          <button type="button" className="button button-secondary button-small" onClick={() => setAchievements((rows) => rows.filter((_, position) => position !== index))}><Trash2 size={14} /> Remove</button>
        </div>
      ))}
      <button type="button" className="button button-secondary button-small" onClick={() => setAchievements((rows) => [...rows, { category: "highlight", title: "", detail: "", gameId: "", yearLabel: "" }])}><Plus size={14} /> Add a highlight</button>
    </section>
  </main>;
}
