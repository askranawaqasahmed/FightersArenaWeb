"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, FileText, Play, Plus, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AdminCompetitionLifecycle } from "./admin-competition-lifecycle";
import { GameCompetitionEditor } from "./game-competition-editor";
import { MediaUploadField } from "./media-upload-field";
import { TournamentStructurePreview } from "./tournament-structure-preview";
import type { AdminLifecycleCompetition } from "@/lib/admin-events";
import { createGameCompetition, normalizeTournamentDraft, stageParticipantCount, tournamentDraftStorageKey, type TournamentDraft } from "@/lib/tournament-draft";
import { parseYouTubeId } from "@/lib/youtube";

type TournamentBuilderProps = {
  initialDraft: TournamentDraft;
  originalSlug?: string;
  lifecycleCompetitions?: AdminLifecycleCompetition[];
};

type SavedDrafts = Record<string, TournamentDraft>;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event-draft";
}

function readSavedDrafts(): SavedDrafts {
  try {
    return JSON.parse(window.localStorage.getItem(tournamentDraftStorageKey) ?? "{}") as SavedDrafts;
  } catch {
    return {};
  }
}

function subscribeToDraftStorage(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getDraftStorageSnapshot() {
  return window.localStorage.getItem(tournamentDraftStorageKey) ?? "";
}

export function TournamentBuilder({ initialDraft, originalSlug, lifecycleCompetitions = [] }: TournamentBuilderProps) {
  const router = useRouter();
  const storedDraftsJson = useSyncExternalStore(subscribeToDraftStorage, getDraftStorageSnapshot, () => "");
  const persistedDraft = useMemo(() => {
    const slug = originalSlug ?? initialDraft.slug;
    if (!slug || !storedDraftsJson) return undefined;
    try {
      const savedDraft = (JSON.parse(storedDraftsJson) as SavedDrafts)[slug];
      return savedDraft ? normalizeTournamentDraft(savedDraft) : undefined;
    } catch {
      return undefined;
    }
  }, [initialDraft.slug, originalSlug, storedDraftsJson]);
  const [draftOverride, setDraftOverride] = useState<TournamentDraft>();
  const draft = draftOverride ?? persistedDraft ?? initialDraft;
  const [previewRequest, setPreviewRequest] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedLifecycleCompetitions, setSavedLifecycleCompetitions] = useState<AdminLifecycleCompetition[]>();
  const previewRef = useRef<HTMLDivElement>(null);
  const nextCompetitionId = useRef(draft.competitions.length + 1);
  const activeLifecycleCompetitions = savedLifecycleCompetitions ?? lifecycleCompetitions;
  const hasStartableCompetition = activeLifecycleCompetitions.some((competition) => !["LIVE", "COMPLETED"].includes(competition.status));
  const isBrowserOnlyDraft = Boolean(originalSlug && persistedDraft && activeLifecycleCompetitions.length === 0);

  function updateLifecycleCompetition(divisionId: string, status: AdminLifecycleCompetition["status"], actualParticipants?: number) {
    setSavedLifecycleCompetitions((current) => (current ?? lifecycleCompetitions).map((competition) => competition.divisionId === divisionId
      ? { ...competition, status, actualParticipants: actualParticipants ?? competition.actualParticipants }
      : competition));
  }

  useEffect(() => {
    if (previewRequest === 0) return;
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    previewRef.current?.focus({ preventScroll: true });
  }, [previewRequest]);

  function updateDraft(changes: Partial<TournamentDraft>) {
    setDraftOverride((currentDraft) => ({ ...(currentDraft ?? persistedDraft ?? initialDraft), ...changes }));
    setMessage("");
    setError("");
  }

  function updateCompetition(id: string, competition: TournamentDraft["competitions"][number]) {
    updateDraft({ competitions: draft.competitions.map((item) => item.id === id ? competition : item) });
  }

  function addCompetition() {
    const id = `competition-${nextCompetitionId.current++}`;
    // The game is chosen from the real catalogue, so a new competition starts blank.
    updateDraft({
      competitions: [...draft.competitions, createGameCompetition(id, {
        name: `Competition ${draft.competitions.length + 1}`,
        stages: draft.hasBracket ? undefined : [],
      })],
    });
  }

  function removeCompetition(id: string) {
    if (draft.competitions.length <= 1) return;
    updateDraft({ competitions: draft.competitions.filter((competition) => competition.id !== id) });
  }

  function validateDraft() {
    if (!draft.name.trim()) return "Enter an event name before saving the draft.";
    if (!draft.startsAt || !draft.endsAt || !draft.location.trim()) return "Event dates and location are required.";
    if (draft.endsAt < draft.startsAt) return "The event end date cannot be before its start date.";
    if (draft.youtubeUrl.trim() && !parseYouTubeId(draft.youtubeUrl)) return "Enter a valid YouTube link, or leave it blank.";
    if (draft.competitions.length < 1) return "An event must contain at least one game competition.";
    for (const competition of draft.competitions) {
      if (!competition.name.trim()) return "Every game competition needs a name.";
      if (!competition.gameSlug) return `${competition.name} needs a game from the catalogue.`;
      // A recorded result has no stages: results are entered on the event page.
      if (draft.hasBracket && competition.stages.length < 1) return `${competition.name} must contain at least one stage.`;
      if (competition.competitionType === "tournament" && competition.maxEntries < 2) return `${competition.name} must allow at least two participants.`;
      if (competition.competitionType === "tournament" && competition.registrationRestricted && competition.registrationLimit < 2) return `${competition.name} needs a registration slot limit of at least two.`;
      if (competition.competitionType === "league" && (competition.leagueTeamCount < 2 || competition.playersPerTeam < 1)) return `${competition.name} must have at least two teams and one player per team.`;
      const competitionParticipantCount = competition.competitionType === "league" ? competition.leagueTeamCount : competition.maxEntries;
      for (const [stageIndex, stage] of competition.stages.entries()) {
        if (stage.format !== "groups" && stageParticipantCount(competition.stages, stageIndex, competitionParticipantCount) < 2) {
          return `${competition.name} must send at least two entrants into stage ${stageIndex + 1}.`;
        }
      }
    }
    return "";
  }

  async function saveDraft() {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    const slug = originalSlug ?? draft.slug ?? slugify(draft.name);
    const savedDraft = {
      ...draft,
      slug,
      // A recorded result must not carry stages left over from toggling the bracket off.
      competitions: draft.hasBracket
        ? draft.competitions
        : draft.competitions.map((competition) => ({ ...competition, stages: [] })),
    };
    const savedDrafts = readSavedDrafts();
    savedDrafts[slug] = savedDraft;
    window.localStorage.setItem(tournamentDraftStorageKey, JSON.stringify(savedDrafts));
    setDraftOverride(savedDraft);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/admin/tournaments/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(savedDraft),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to synchronize this event with the tournament database.");
      setSavedLifecycleCompetitions(body.data.lifecycleCompetitions as AdminLifecycleCompetition[]);
      setMessage("Event draft saved successfully to PostgreSQL with all game competitions and stages. Tournament controls are ready.");
      if (!originalSlug) router.replace(`/admin/tournaments/${encodeURIComponent(slug)}/edit`);
      else router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? `${saveError.message} A browser backup was kept.` : "Database synchronization failed. A browser backup was kept.");
    } finally {
      setSaving(false);
    }
  }

  function openPreview() {
    setPreviewRequest((request) => request + 1);
    setMessage("");
    setError("");
  }

  return (
    <main className={`admin-content${originalSlug ? " event-editor-full" : ""}`}>
      <Link className="text-link" href="/admin/tournaments"><ArrowLeft size={14} /> Events</Link>
      <div className="section-header" style={{ marginTop: 18 }}>
        <div><h1 className="admin-heading">{originalSlug ? "Edit event" : "Create event"}</h1><p className="admin-subtitle">One event can contain multiple game tournaments and leagues, each with its own stages and participant workflow.</p></div>
        <div className="header-actions">{hasStartableCompetition && <a className="button button-primary" href="#tournament-controls"><Play size={15} /> Start tournament</a>}<button className="button button-secondary" type="button" onClick={openPreview}><Eye size={15} /> Preview</button><button className="button button-primary" type="button" disabled={saving} onClick={saveDraft}><Save size={15} /> {saving ? "Saving…" : "Save draft"}</button></div>
      </div>

      {error && <p className="form-message form-error" role="alert">{error}</p>}
      {message && <p className="form-message form-success" role="status">{message}</p>}

      {(originalSlug || activeLifecycleCompetitions.length > 0) && <section className="card panel tournament-control-panel" id="tournament-controls" aria-label="Tournament controls">
        <div className="section-header stage-header"><div><span className="status">TOURNAMENT LIFECYCLE</span><h2 className="panel-title">Start tournament</h2><p className="helper">Starting validates confirmed, eligible, checked-in signups before saving the generated bracket and matches.</p></div></div>
        {activeLifecycleCompetitions.length > 0
          ? <div className="activity">{activeLifecycleCompetitions.map((competition) => <AdminCompetitionLifecycle competition={competition} onStatusChange={(status, participants) => updateLifecycleCompetition(competition.divisionId, status, participants)} key={competition.divisionId} />)}</div>
          : <div className="start-unavailable"><Play size={18} aria-hidden="true" /><div><strong>{isBrowserOnlyDraft ? "This browser-only draft must be saved before the tournament can start." : "Save this draft to enable Start tournament."}</strong><p>Saving now synchronizes the event, game competitions, and stages with PostgreSQL. Then add real signups or rehearsal signups before starting.</p></div><button className="button button-primary button-small" type="button" disabled={saving} onClick={saveDraft}><Save size={14} /> {saving ? "Saving…" : "Save draft to enable"}</button></div>}
      </section>}

      <section className="event-builder-full">
          <div className="card panel">
            <h2 className="panel-title">Event details</h2>
            <label className="form-group"><span className="form-label">Event name</span><input className="input" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} /></label>
            <label className="form-group" style={{ marginTop: 16 }}><span className="form-label">Event description</span><textarea className="textarea" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} /></label>
            <div className="builder-grid" style={{ marginTop: 16 }}><label className="form-group"><span className="form-label">Start date</span><input className="input" type="date" value={draft.startsAt} onChange={(event) => updateDraft({ startsAt: event.target.value })} /></label><label className="form-group"><span className="form-label">End date</span><input className="input" type="date" value={draft.endsAt} onChange={(event) => updateDraft({ endsAt: event.target.value })} /></label></div>
            <label className="form-group" style={{ marginTop: 16 }}><span className="form-label">Location</span><input className="input" value={draft.location} onChange={(event) => updateDraft({ location: event.target.value })} /></label>
            <div className="builder-grid" style={{ marginTop: 16 }}>
              <div className="form-group">
                <label className="form-group">
                  <span className="form-label">Bracket</span>
                  <select className="select" value={draft.hasBracket ? "bracket" : "result"} onChange={(event) => updateDraft({ hasBracket: event.target.value === "bracket" })}>
                    <option value="bracket">Run a bracket on the platform</option>
                    <option value="result">Record final results only</option>
                  </select>
                </label>
                <span className="helper">{draft.hasBracket ? "Stages, matches and standings are generated here." : "No stages or matches. Enter the final placements on the event page."}</span>
              </div>
              <div className="form-group">
                <label className="form-group">
                  <span className="form-label">YouTube link</span>
                  <input className="input" value={draft.youtubeUrl} onChange={(event) => updateDraft({ youtubeUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
                </label>
                <span className="helper">Optional. Adds a Watch button to the public event page.</span>
              </div>
            </div>
            <div className="builder-grid" style={{ marginTop: 16 }}><MediaUploadField purpose="event-image" label="Event cover image" accept="image/png,image/jpeg,image/webp,image/gif" altText={draft.imageAlt} onUploaded={(media) => updateDraft({ imageUrl: media.url })} onError={setError} /><label className="form-group"><span className="form-label">Event image alt text</span><input className="input" value={draft.imageAlt} onChange={(event) => updateDraft({ imageAlt: event.target.value })} /></label></div>
            {draft.imageUrl && <div className="event-image-preview" role="img" aria-label={draft.imageAlt || "Event cover preview"} style={{ backgroundImage: `linear-gradient(90deg, rgba(7,20,14,.72), rgba(7,20,14,.08)), url("${draft.imageUrl}")` }}><strong>{draft.name}</strong></div>}
            <div className="content-attachments"><MediaUploadField purpose="attachment" label="Event attachments" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onUploaded={(media) => updateDraft({ attachments: [...draft.attachments, { key: media.key, url: media.url, name: media.originalName, mimeType: media.mimeType, sizeBytes: media.sizeBytes }] })} onError={setError} />{draft.attachments.map((attachment) => <div className="attachment-row" key={attachment.key}><FileText size={15} /><a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a><button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => updateDraft({ attachments: draft.attachments.filter((item) => item.key !== attachment.key) })}><X size={14} /></button></div>)}</div>
          </div>

          <div className="section-header event-competitions-header"><div><h2 className="panel-title">Game competitions</h2><p className="helper">Add one tournament or league for every game running under this event.</p></div><button className="button button-secondary" type="button" onClick={addCompetition}><Plus size={15} /> Add game competition</button></div>
          <div className="activity">
            {draft.competitions.map((competition, index) => <GameCompetitionEditor key={competition.id} competition={competition} index={index} canRemove={draft.competitions.length > 1} hasBracket={draft.hasBracket} onChange={(updated) => updateCompetition(competition.id, updated)} onRemove={() => removeCompetition(competition.id)} />)}
          </div>
      </section>

      <div className="preview-anchor" ref={previewRef} tabIndex={-1}><TournamentStructurePreview draft={draft} /></div>
    </main>
  );
}
