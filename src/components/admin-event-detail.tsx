"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Gamepad2, MapPin, Pencil, Play, Trophy } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { EventImageGallery } from "./event-image-gallery";
import { AdminCompetitionLifecycle } from "./admin-competition-lifecycle";
import { AdminEventLifecycleControls } from "./admin-event-lifecycle-controls";
import { EventParticipantTable } from "./event-participant-table";
import type { AdminEvent, AdminLifecycleCompetition } from "@/lib/admin-events";
import { normalizeTournamentDraft, tournamentDraftStorageKey, type StageFormat, type TournamentDraft } from "@/lib/tournament-draft";

const gameNames = { "dota-2": "Dota 2", valorant: "VALORANT", "tekken-8": "Tekken 8" } as const;
const gameName = (slug: string) => gameNames[slug as keyof typeof gameNames] ?? slug;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot() {
  return window.localStorage.getItem(tournamentDraftStorageKey) ?? "";
}

function stageLabel(format: StageFormat) {
  if (format === "groups") return "Round-robin groups";
  if (format === "single-elimination") return "Single elimination";
  return "Double elimination";
}

export function AdminEventDetail({ slug, initialEvent, lifecycleCompetitions = [], databaseBacked = false }: { slug: string; initialEvent?: AdminEvent; lifecycleCompetitions?: AdminLifecycleCompetition[]; databaseBacked?: boolean }) {
  const storedDrafts = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const event = useMemo(() => {
    if (databaseBacked) return initialEvent;
    let draft: TournamentDraft | undefined;
    try {
      const parsed = storedDrafts ? JSON.parse(storedDrafts) as Record<string, TournamentDraft> : {};
      if (parsed[slug]) draft = normalizeTournamentDraft(parsed[slug]);
    } catch {
      draft = undefined;
    }
    if (!draft) return initialEvent;
    return {
      id: initialEvent?.id,
      slug,
      name: draft.name,
      description: draft.description,
      imageUrl: draft.imageUrl,
      imageAlt: draft.imageAlt,
      attachments: draft.attachments,
      galleryImages: initialEvent?.galleryImages,
      date: draft.startsAt && draft.endsAt ? `${draft.startsAt} – ${draft.endsAt}` : initialEvent?.date ?? "Not scheduled",
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      location: draft.location || initialEvent?.location || "Location not set",
      status: "DRAFT" as const,
      competitions: draft.competitions.map((competition, index) => {
        const existingCompetition = initialEvent?.competitions.find((item) => item.gameSlug === competition.gameSlug) ?? initialEvent?.competitions[index];
        return {
          id: existingCompetition?.id ?? competition.id,
          name: competition.name,
          gameSlug: competition.gameSlug,
          game: gameName(competition.gameSlug),
          type: competition.competitionType,
          status: "DRAFT" as const,
          capacity: competition.competitionType === "league" ? competition.leagueTeamCount * competition.playersPerTeam : competition.maxEntries,
          registrationRestricted: competition.competitionType === "tournament" ? competition.registrationRestricted : undefined,
          registrationLimit: competition.competitionType === "tournament" && competition.registrationRestricted ? competition.registrationLimit : undefined,
          teamCount: competition.competitionType === "league" ? competition.leagueTeamCount : undefined,
          playersPerTeam: competition.competitionType === "league" ? competition.playersPerTeam : undefined,
          stages: competition.stages.map((stage) => stage.format),
          participants: existingCompetition?.participants ?? [],
        };
      }),
    } satisfies AdminEvent;
  }, [databaseBacked, initialEvent, slug, storedDrafts]);

  if (!event) return <main className="admin-content"><div className="account-empty card"><Trophy className="green" /><h1>Event not found</h1><p className="muted">This event does not exist or its draft was removed.</p><Link className="button button-secondary" href="/admin/tournaments">Back to events</Link></div></main>;

  const participants = event.competitions.flatMap((competition) => competition.participants);
  const confirmedEntrants = participants.filter((participant) => participant.registrationStatus === "confirmed").length;
  const pendingConfirmations = participants.filter((participant) => participant.registrationStatus === "pending").length;
  const hasStartableCompetition = lifecycleCompetitions.some((competition) => !["LIVE", "COMPLETED"].includes(competition.status));

  return (
    <main className="admin-content">
      <Link className="text-link" href="/admin/tournaments"><ArrowLeft size={14} /> Events</Link>
      <div className="section-header" style={{ marginTop: 18 }}><div><div className="eyebrow">Multi-game event</div><h1 className="admin-heading">{event.name}</h1><p className="admin-subtitle">{event.description}</p></div><div className="header-actions"><span className={`status ${event.status === "LIVE" ? "live" : ""}`}>{event.status}</span>{hasStartableCompetition && <a className="button button-primary" href="#tournament-controls"><Play size={15} /> Start tournament</a>}<Link className="button button-secondary" href={`/admin/tournaments/${event.slug}/edit`}><Pencil size={15} /> Edit event</Link></div></div>
      {databaseBacked && event.id && <AdminEventLifecycleControls tournamentId={event.id} status={event.status} />}
      {event.imageUrl && <div className="event-detail-cover" role="img" aria-label={event.imageAlt || `${event.name} cover`} style={{ backgroundImage: `linear-gradient(90deg, rgba(7,20,14,.64), rgba(7,20,14,.06)), url("${event.imageUrl}")` }}><span>{event.name}</span></div>}
      <div className="filter-bar"><span className="filter-chip static"><CalendarDays size={14} /> {event.date}</span><span className="filter-chip static"><MapPin size={14} /> {event.location}</span><span className="filter-chip static"><Gamepad2 size={14} /> {event.competitions.length} games</span></div>
      {event.attachments && event.attachments.length > 0 && <section className="card panel event-attachments"><h2 className="panel-title">Event attachments</h2>{event.attachments.map((attachment) => <a className="attachment-row" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}><FileText size={15} /><span>{attachment.name}</span><span className="muted">{Math.ceil(attachment.sizeBytes / 1024)} KB</span></a>)}</section>}
      <div className="admin-stats"><div className="card admin-stat"><div className="stat-value">{event.competitions.length}</div><div className="stat-label">Game competitions</div></div><div className="card admin-stat"><div className="stat-value">{participants.length}</div><div className="stat-label">Visible participants</div></div><div className="card admin-stat"><div className="stat-value">{confirmedEntrants}</div><div className="stat-label">Approved entrants</div></div><div className="card admin-stat"><div className="stat-value">{pendingConfirmations}</div><div className="stat-label">Confirmations pending</div></div></div>
      <EventImageGallery eventSlug={event.slug} eventName={event.name} endsAt={event.endsAt} status={event.status} tournamentId={event.id} initialImages={event.galleryImages} />
      <div className="activity event-competition-details" id="tournament-controls">{event.competitions.map((competition, index) => { const lifecycle = lifecycleCompetitions.find((item) => item.divisionId === competition.id); return <section className="card panel" key={competition.id}><div className="section-header"><div><span className="status">GAME {index + 1} · {competition.type.toUpperCase()}</span><h2 className="section-title event-competition-title">{competition.name}</h2><p className="muted">{competition.game}{competition.type === "league" ? ` · ${competition.teamCount} teams · ${competition.playersPerTeam} players per team` : ` · ${competition.capacity} planned participants · ${competition.registrationRestricted ? `${competition.registrationLimit} registration slots` : "unrestricted registration"}`}</p></div><span className={`status ${competition.status === "LIVE" ? "live" : ""}`}>{competition.status}</span></div><div className="filter-bar">{competition.stages.map((stage, stageIndex) => <span className="filter-chip static" key={`${stage}-${stageIndex}`}>Stage {stageIndex + 1}: {stageLabel(stage)}</span>)}</div>{lifecycle && <AdminCompetitionLifecycle competition={lifecycle} />}<EventParticipantTable eventSlug={event.slug} competition={competition} /></section>; })}</div>
    </main>
  );
}
