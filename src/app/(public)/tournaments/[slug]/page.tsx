import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, GitBranch, Globe, MapPin, PlayCircle, Radio, Trophy, Users } from "lucide-react";
import { ShareButton } from "@/components/share-button";
import { isTitle, placementLabel } from "@/lib/placement";
import { getPublicTournament } from "@/lib/public-tournament-data";
import { parseYouTubeId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const detail = await getPublicTournament((await params).slug);
  if (!detail) return { title: "Tournament" };
  return { title: detail.name, description: detail.description ?? undefined };
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPublicTournament(slug);
  if (!detail) notFound();
  const isLive = detail.status === "live";
  const hasVideo = parseYouTubeId(detail.youtubeUrl) !== null;
  // An event without a bracket is a recorded result: show placements, not match progress.
  const showBracketColumns = detail.hasBracket;

  return (
    <div className="page-shell">
      <div className="container">
        <span className={`status ${isLive ? "live" : ""}`}>{isLive && <span className="live-dot" />}{detail.statusLabel}</span>
        <h1 className="page-title">{detail.name}</h1>
        {detail.description && <p className="lede">{detail.description}</p>}
        <div className="filter-bar">
          <span className="filter-chip static"><CalendarDays size={14} /> {detail.date}</span>
          <span className="filter-chip static">{detail.online ? <><Globe size={14} /> Online</> : <><MapPin size={14} /> {detail.country ?? "Venue event"}</>}</span>
          <span className="filter-chip static"><Users size={14} /> {detail.teams} participants</span>
          <span className="filter-chip static"><Trophy size={14} /> {detail.game}</span>
          {hasVideo && (
            <Link className="button button-primary button-small" href={`/tournaments/${detail.slug}/watch`}>
              <PlayCircle size={15} /> Watch tournament
            </Link>
          )}
          <ShareButton title={detail.name} />
        </div>

        <section className="competition-status-grid" aria-label="Event summary">
          <div className="stat"><div className="stat-value">{detail.divisions}</div><div className="stat-label">Game competitions</div></div>
          <div className="stat"><div className="stat-value">{detail.teams}</div><div className="stat-label">Participants</div></div>
          {showBracketColumns
            ? <div className="stat"><div className="stat-value">{detail.progress}%</div><div className="stat-label">Matches complete</div></div>
            : <div className="stat"><div className="stat-value">{detail.status === "completed" ? "FINAL" : "—"}</div><div className="stat-label">Results</div></div>}
        </section>

        <section className="card panel" aria-label="Competitions in this event">
          <div className="section-header">
            <div>
              <div className="eyebrow">Game competitions</div>
              <h2 className="panel-title">{showBracketColumns ? "Brackets & results" : "Final results"}</h2>
              <p className="helper">
                {showBracketColumns
                  ? "Each game competition keeps its own bracket, matches and standings."
                  : "This event is recorded as a final result, without a bracket."}
              </p>
            </div>
          </div>

          {detail.divisionList.length === 0 ? (
            <div className="account-empty compact">
              <Trophy className="green" />
              <h3>Competitions are being finalised</h3>
              <p className="muted">Game competitions appear here once the organizer publishes them.</p>
            </div>
          ) : showBracketColumns ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Competition</th><th>Game</th><th>Format</th><th>Participants</th><th>Matches</th><th>Status</th><th>Bracket</th></tr>
                </thead>
                <tbody>
                  {detail.divisionList.map((division) => (
                    <tr key={division.id}>
                      <td><strong>{division.name}</strong>{division.stageName && <div className="muted">{division.stageName}</div>}</td>
                      <td>{division.game}</td>
                      <td>{division.formatLabel}{division.bestOf ? <div className="muted">Best of {division.bestOf}</div> : null}</td>
                      <td>{division.participants}</td>
                      <td>
                        {division.totalMatches > 0
                          ? <>{division.finishedMatches}/{division.totalMatches} complete{division.liveMatches > 0 && <div className="green">{division.liveMatches} live now</div>}</>
                          : <span className="muted">Not started</span>}
                      </td>
                      <td>
                        <span className={`status ${division.status === "live" ? "live" : ""}`}>
                          {division.status === "live" && <span className="live-dot" />}{division.statusLabel}
                        </span>
                      </td>
                      <td>
                        {division.bracketAvailable
                          ? <Link className="button button-primary button-small" href={`/tournaments/${detail.slug}/bracket?division=${division.id}`}>
                              {division.liveMatches > 0 ? <Radio size={14} /> : <GitBranch size={14} />} View bracket
                            </Link>
                          : <span className="muted">Available at start</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            detail.divisionList.map((division) => (
              <div key={division.id} style={{ marginTop: 18 }}>
                <h3 className="panel-title">{division.game}{detail.divisionList.length > 1 && ` · ${division.name}`}</h3>
                {division.placements.length === 0 ? (
                  <p className="muted">No results recorded yet.</p>
                ) : division.placements.map((entry) => (
                  <div className="achievement" key={`${division.id}-${entry.displayName}`}>
                    <div>
                      {entry.gamerSlug
                        ? <Link href={`/gamers/${entry.gamerSlug}`}><strong>{entry.displayName}</strong></Link>
                        : <strong>{entry.displayName}</strong>}
                    </div>
                    <strong className={isTitle(entry.finalRank) ? "green" : undefined}>
                      {placementLabel(entry.finalRank, entry.placementLabel)}
                    </strong>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
