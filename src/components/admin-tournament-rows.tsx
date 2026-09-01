"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { AdminEvent } from "@/lib/admin-events";
import { normalizeTournamentDraft, tournamentDraftStorageKey, type TournamentDraft } from "@/lib/tournament-draft";

type EventSummary = {
  slug: string;
  name: string;
  games: string;
  competitions: string;
  date: string;
  status: string;
  sortAt: string;
};

const gameNames = { "dota-2": "Dota 2", valorant: "VALORANT", "tekken-8": "Tekken 8" } as const;
const gameName = (slug: string) => gameNames[slug as keyof typeof gameNames] ?? slug;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot() {
  return window.localStorage.getItem(tournamentDraftStorageKey) ?? "";
}

function draftSummary(draft: TournamentDraft): EventSummary {
  const tournamentCount = draft.competitions.filter((competition) => competition.competitionType === "tournament").length;
  const leagueCount = draft.competitions.length - tournamentCount;
  return {
    slug: draft.slug ?? "event-draft",
    name: draft.name,
    games: [...new Set(draft.competitions.map((competition) => gameName(competition.gameSlug)))].join(", "),
    competitions: `${tournamentCount} tournament${tournamentCount === 1 ? "" : "s"} · ${leagueCount} league${leagueCount === 1 ? "" : "s"}`,
    date: draft.startsAt && draft.endsAt ? `${draft.startsAt} – ${draft.endsAt}` : "Not scheduled",
    status: "DRAFT",
    sortAt: draft.startsAt,
  };
}

function eventSummary(event: AdminEvent): EventSummary {
  const tournamentCount = event.competitions.filter((competition) => competition.type === "tournament").length;
  const leagueCount = event.competitions.length - tournamentCount;
  return {
    slug: event.slug,
    name: event.name,
    games: [...new Set(event.competitions.map((competition) => competition.game))].join(", "),
    competitions: `${tournamentCount} tournament${tournamentCount === 1 ? "" : "s"} · ${leagueCount} league${leagueCount === 1 ? "" : "s"}`,
    date: event.date,
    status: event.status,
    sortAt: event.createdAt ?? event.startsAt,
  };
}

function eventTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function orderEventRows(left: EventSummary, right: EventSummary) {
  const livePriority = Number(right.status === "LIVE") - Number(left.status === "LIVE");
  return livePriority || eventTimestamp(right.sortAt) - eventTimestamp(left.sortAt);
}

export function AdminTournamentRows({ initialEvents }: { initialEvents: readonly AdminEvent[] }) {
  const storedDraftsJson = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const eventRows = useMemo(() => {
    let savedDrafts: Record<string, TournamentDraft> = {};
    try {
      const parsedDrafts = storedDraftsJson ? JSON.parse(storedDraftsJson) as Record<string, TournamentDraft> : {};
      savedDrafts = Object.fromEntries(Object.entries(parsedDrafts).map(([slug, draft]) => [slug, normalizeTournamentDraft(draft)]));
    } catch {
      savedDrafts = {};
    }
    const initialSlugs = new Set(initialEvents.map((event) => event.slug));
    return [
      ...initialEvents.map(eventSummary),
      ...Object.values(savedDrafts).filter((draft) => draft.slug && !initialSlugs.has(draft.slug)).map(draftSummary),
    ].sort(orderEventRows);
  }, [initialEvents, storedDraftsJson]);

  return eventRows.map((event) => (
    <tr key={event.slug}>
      <td><strong>{event.name}</strong><div className="muted">{event.games}</div></td>
      <td>{event.competitions}</td>
      <td>{event.date}</td>
      <td><span className={`status ${event.status === "LIVE" ? "live" : ""}`}>{event.status}</span></td>
      <td><div className="header-actions"><Link className="button button-secondary button-small" href={`/admin/tournaments/${event.slug}`} aria-label={`View ${event.name}`}><Eye size={15} /> Details</Link><Link className="button button-secondary button-small" href={`/admin/tournaments/${event.slug}/edit`} aria-label={`Edit ${event.name}`}><Pencil size={15} /> Edit</Link></div></td>
    </tr>
  ));
}
