"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { ConnectedEliminationBracket } from "@/components/connected-elimination-bracket";
import type { PublicBracketView, PublicMatchSide } from "@/lib/public-tournament-data";

const POLL_INTERVAL_MS = 5000;

const completedStatuses = new Set(["final", "forfeit", "cancelled"]);

function statusPill(status: string) {
  return <span className={`status ${status === "live" ? "live" : ""}`}>{status === "live" && <span className="live-dot" />}{status.toUpperCase()}</span>;
}

/** Resolved participants link to their public profile; unresolved slots show their source. */
function SideName({ side, winner }: { side: PublicMatchSide | undefined; winner: boolean }) {
  const label = side?.name
    ?? (side?.sourceMatchCode
      ? `${side.sourceOutcome === "loser" ? "Loser" : "Winner"} of ${side.sourceMatchCode}`
      : "TBD");
  const className = winner ? "green" : undefined;
  // Only gamers have a public profile page today; team names stay plain text.
  if (side?.profileSlug && side.participantType === "gamer") {
    return <div className={className}><Link href={`/gamers/${side.profileSlug}`}>{label}</Link></div>;
  }
  return <div className={className}>{label}</div>;
}

export function PublicLiveBracket({
  slug,
  divisionId,
  initialView,
}: {
  slug: string;
  divisionId: string;
  initialView: PublicBracketView;
}) {
  const [view, setView] = useState(initialView);
  const [stale, setStale] = useState(false);
  const etagRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const hasLiveMatch = view.matches.some((match) => match.status === "live");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers["if-none-match"] = etagRef.current;
        const response = await fetch(
          `/api/v1/tournaments/${slug}/bracket?division=${divisionId}`,
          { headers, cache: "no-store" },
        );
        if (response.status === 304) {
          if (!cancelled) setStale(false);
          return;
        }
        if (!response.ok) throw new Error(`Bracket request failed with ${response.status}`);
        const body = (await response.json()) as { data: PublicBracketView };
        etagRef.current = response.headers.get("etag");
        if (!cancelled) {
          setView(body.data);
          setStale(false);
        }
      } catch {
        if (!cancelled) setStale(true);
      } finally {
        inFlightRef.current = false;
      }
    };
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [slug, divisionId]);

  const orderedMatches = [...view.matches].sort((left, right) => left.matchNumber - right.matchNumber);

  return (
    <>
      <div className="filter-bar bracket-live-bar">
        {hasLiveMatch
          ? <span className="filter-chip static live-indicator"><Radio size={14} /> Live — updating automatically</span>
          : <span className="filter-chip static"><RefreshCw size={14} /> {view.division.finishedMatches}/{view.division.totalMatches} matches complete</span>}
        {stale && <span className="filter-chip static">Reconnecting…</span>}
      </div>

      {view.bracket
        ? <ConnectedEliminationBracket bracket={view.bracket} matches={orderedMatches} />
        : (
          <div className="card account-empty compact">
            <h3>{view.division.formatLabel} competition</h3>
            <p className="muted">This format has no elimination bracket. Fixtures and standings are listed below.</p>
          </div>
        )}

      <section className="card panel" aria-label="Match results">
        <div className="section-header">
          <div><div className="eyebrow">All matches</div><h2 className="panel-title">Results & schedule</h2></div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Match</th><th>Round</th><th>Participants</th><th>Score</th><th>Series</th><th>Status</th></tr></thead>
            <tbody>
              {orderedMatches.map((match) => {
                const [left, right] = [match.sides[0], match.sides[1]];
                const decided = completedStatuses.has(match.status);
                return (
                  <tr key={match.id}>
                    <td><strong>Match #{match.matchNumber}</strong><div className="muted match-code-label">{match.code}</div></td>
                    <td>{match.round}<div className="muted">{match.lane}</div></td>
                    <td>
                      <SideName side={left} winner={Boolean(match.winnerParticipantId && match.winnerParticipantId === left?.participantId)} />
                      <SideName side={right} winner={Boolean(match.winnerParticipantId && match.winnerParticipantId === right?.participantId)} />
                    </td>
                    <td>{decided || match.status === "live" || match.status === "paused"
                      ? <strong>{left?.score ?? 0}–{right?.score ?? 0}</strong>
                      : <span className="muted">—</span>}</td>
                    <td>BO{match.bestOf}</td>
                    <td>{statusPill(match.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {view.standings.length > 0 && (
        <section className="card panel" aria-label="Standings">
          <div className="section-header">
            <div><div className="eyebrow">Table</div><h2 className="panel-title">Standings</h2></div>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>#</th><th>Participant</th><th>Played</th><th>W</th><th>D</th><th>L</th><th>Score</th><th>Points</th></tr></thead>
              <tbody>
                {view.standings.map((row) => (
                  <tr key={`${row.rank}-${row.name}`}>
                    <td><strong className={row.rank === 1 ? "green" : undefined}>{row.rank}</strong></td>
                    <td>{row.profileSlug && row.participantType === "gamer"
                      ? <Link href={`/gamers/${row.profileSlug}`}>{row.name}</Link>
                      : row.name}</td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.draws}</td>
                    <td>{row.losses}</td>
                    <td>{row.scoreFor}–{row.scoreAgainst}</td>
                    <td><strong>{row.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
