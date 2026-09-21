"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { achievementCategories, achievementCategoryLabels, type AchievementCategory } from "@/lib/achievement-labels";

type GameOption = { id: string; name: string };
type CityOption = { id: string; name: string };

type GameEntry = { gameId: string; inGameName: string; primaryRole: string | null; platform: string | null };

type Achievement = {
  id: string;
  category: string;
  title: string;
  detail: string | null;
  gameId: string | null;
  yearLabel: string | null;
};

type Props = {
  profile: {
    slug: string;
    displayName: string;
    handle: string;
    bio: string | null;
    cityId: string | null;
    profileVisibility: "private" | "sponsors" | "public";
  };
  games: GameEntry[];
  achievements: Achievement[];
  gameOptions: GameOption[];
  cityOptions: CityOption[];
};

const blankAchievement = { category: "highlight" as AchievementCategory, title: "", detail: "", gameId: "", yearLabel: "" };

export function DashboardProfileEditor({ profile, games, achievements, gameOptions, cityOptions }: Props) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [cityId, setCityId] = useState(profile.cityId ?? "");
  const [visibility, setVisibility] = useState(profile.profileVisibility);
  const [gameRows, setGameRows] = useState<GameEntry[]>(games);
  const [message, setMessage] = useState("Changes appear on your public profile straight away.");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState(blankAchievement);
  const [achievementMessage, setAchievementMessage] = useState("Add anything that is not a tournament result.");
  const [achievementError, setAchievementError] = useState(false);
  const [achievementSaving, setAchievementSaving] = useState(false);

  function updateGameRow(index: number, patch: Partial<GameEntry>) {
    setGameRows((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          handle,
          bio: bio.trim() === "" ? null : bio.trim(),
          cityId: cityId === "" ? null : cityId,
          profileVisibility: visibility,
          games: gameRows
            .filter((row) => row.gameId && row.inGameName.trim() !== "")
            .map((row) => ({
              gameId: row.gameId,
              inGameName: row.inGameName.trim(),
              primaryRole: row.primaryRole?.trim() || null,
              platform: row.platform?.trim() || null,
            })),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(body.errors?.[0]?.message ?? body.detail ?? "Your profile could not be saved.");
        return;
      }
      setMessage("Profile saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addAchievement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAchievementSaving(true);
    setAchievementError(false);
    try {
      const response = await fetch("/api/v1/me/achievements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: draft.category,
          title: draft.title.trim(),
          detail: draft.detail.trim() === "" ? null : draft.detail.trim(),
          gameId: draft.gameId === "" ? null : draft.gameId,
          yearLabel: draft.yearLabel.trim() === "" ? null : draft.yearLabel.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setAchievementError(true);
        setAchievementMessage(body.errors?.[0]?.message ?? body.detail ?? "The entry could not be added.");
        return;
      }
      setDraft(blankAchievement);
      setAchievementMessage("Added.");
      router.refresh();
    } finally {
      setAchievementSaving(false);
    }
  }

  async function removeAchievement(id: string) {
    const response = await fetch(`/api/v1/me/achievements/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setAchievementError(true);
      setAchievementMessage("The entry could not be removed.");
      return;
    }
    setAchievementMessage("Removed.");
    router.refresh();
  }

  return (
    <div className="profile-grid">
      <section className="card panel entity-editor">
        <h2 className="panel-title">Profile details</h2>
        <form className="auth-form" onSubmit={saveProfile}>
          <label className="form-group">
            <span className="form-label">Display name</span>
            <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={100} required />
          </label>
          <label className="form-group">
            <span className="form-label">Gamer tag</span>
            <input className="input" value={handle} onChange={(event) => setHandle(event.target.value)} minLength={2} maxLength={80} required />
          </label>
          <label className="form-group">
            <span className="form-label">Biography</span>
            <textarea className="textarea" rows={5} maxLength={2000} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell visitors about your career, your main characters and what you are working towards." />
          </label>
          <label className="form-group">
            <span className="form-label">City</span>
            <select className="select" value={cityId} onChange={(event) => setCityId(event.target.value)}>
              <option value="">Not set</option>
              {cityOptions.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Profile visibility</span>
            <select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value as Props["profile"]["profileVisibility"])}>
              <option value="public">Public — anyone can view</option>
              <option value="sponsors">Sponsors only</option>
              <option value="private">Private</option>
            </select>
          </label>

          <h3 className="panel-title" style={{ marginTop: 18 }}>Games</h3>
          {gameRows.map((row, index) => (
            <div className="builder-grid" key={`${row.gameId}-${index}`}>
              <label className="form-group">
                <span className="form-label">Game</span>
                <select className="select" value={row.gameId} onChange={(event) => updateGameRow(index, { gameId: event.target.value })}>
                  <option value="">Select a game</option>
                  {gameOptions.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">In-game name</span>
                <input className="input" value={row.inGameName} onChange={(event) => updateGameRow(index, { inGameName: event.target.value })} maxLength={100} />
              </label>
              <button type="button" className="button button-secondary button-small" onClick={() => setGameRows((rows) => rows.filter((_, position) => position !== index))}>
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
          <button type="button" className="button button-secondary button-small" onClick={() => setGameRows((rows) => [...rows, { gameId: "", inGameName: handle, primaryRole: null, platform: null }])}>
            <Plus size={14} /> Add a game
          </button>

          <button className="button button-primary" disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save profile"}</button>
          <p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p>
        </form>
      </section>

      <section className="card panel entity-editor">
        <h2 className="panel-title">Career highlights</h2>
        <p className="muted">Tournament results come from the events themselves. Add everything else here.</p>
        {achievements.map((entry) => (
          <div className="achievement" key={entry.id}>
            <div>
              <strong>{entry.title}</strong>
              <div className="muted">
                {[achievementCategoryLabels[entry.category as AchievementCategory] ?? entry.category, entry.detail, entry.yearLabel].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button type="button" className="button button-secondary button-small" onClick={() => removeAchievement(entry.id)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <form className="auth-form" onSubmit={addAchievement}>
          <label className="form-group">
            <span className="form-label">Type</span>
            <select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as AchievementCategory })}>
              {achievementCategories.map((category) => (
                <option key={category} value={category}>{achievementCategoryLabels[category]}</option>
              ))}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Title</span>
            <input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={200} required />
          </label>
          <label className="form-group">
            <span className="form-label">Detail (optional)</span>
            <input className="input" value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} maxLength={2000} />
          </label>
          <div className="builder-grid">
            <label className="form-group">
              <span className="form-label">Game (optional)</span>
              <select className="select" value={draft.gameId} onChange={(event) => setDraft({ ...draft, gameId: event.target.value })}>
                <option value="">Not specific</option>
                {gameOptions.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Year (optional)</span>
              <input className="input" value={draft.yearLabel} onChange={(event) => setDraft({ ...draft, yearLabel: event.target.value })} maxLength={40} placeholder="2014–2019" />
            </label>
          </div>
          <button className="button button-secondary" disabled={achievementSaving}><Plus size={16} /> {achievementSaving ? "Adding…" : "Add entry"}</button>
          <p className={`helper${achievementError ? " form-error" : ""}`} role="status">{achievementMessage}</p>
        </form>
      </section>
    </div>
  );
}
