import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BadgeCheck, CalendarDays, Download, Gamepad2, GraduationCap, MapPin, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { getPublicGamer, type PublicGamerAchievement } from "@/lib/public-gamer-data";
import { isTitle, placementBadge, placementLabel, placementMedalClass } from "@/lib/placement";
import { publicStatusLabel } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

const ACHIEVEMENT_GROUPS: Array<{ category: string; title: string; icon: typeof Award }> = [
  { category: "milestone", title: "Milestones", icon: Award },
  { category: "highlight", title: "Career highlights", icon: Trophy },
  { category: "coaching", title: "Players coached", icon: GraduationCap },
  { category: "player_developed", title: "Players developed", icon: Users },
];

function groupAchievements(achievements: PublicGamerAchievement[]) {
  return ACHIEVEMENT_GROUPS
    .map((group) => ({ ...group, items: achievements.filter((entry) => entry.category === group.category) }))
    .filter((group) => group.items.length > 0);
}

function formatDate(value: string | null) {
  if (!value) return "Date TBA";
  return new Date(value).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const gamer = await getPublicGamer((await params).slug);
  if (!gamer) return { title: "Player" };
  return { title: `${gamer.handle} — ${gamer.name}`, description: gamer.bio ?? undefined };
}

export default async function GamerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = await getPublicGamer(slug);
  if (!gamer) notFound();
  const location = [gamer.city, gamer.country].filter(Boolean).join(", ");
  const achievementGroups = groupAchievements(gamer.achievements);
  // Historical profiles carry placements but no match-by-match record, so show career totals instead.
  const showMatchStats = gamer.totals.played > 0;

  return (
    <div className="page-shell">
      <div className="container">
        <section className="card profile-hero">
          {gamer.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element -- operator-uploaded avatar served from our own media route
            ? <img className="avatar avatar-image" src={gamer.avatarUrl} alt={gamer.name} />
            : <div className="avatar">{gamer.initials}</div>}
          <div>
            {/* Ranking points are set by an operator. Until someone has been given any,
                every profile ties on zero and a "rank" would just be alphabetical noise. */}
            {gamer.points > 0
              ? <div className="eyebrow">National rank #{gamer.rank}</div>
              : <div className="eyebrow">{gamer.game ?? "Competitor"}</div>}
            <h1 style={{ margin: "7px 0", fontSize: 38 }}>
              {gamer.handle} {gamer.verified && <BadgeCheck className="verified" size={23} />}
            </h1>
            <div className="muted">
              {gamer.name}
              {location && <> · <MapPin size={13} /> {location}</>}
              {gamer.game && <> · {gamer.game}</>}
            </div>
            <div className="profile-role"><Swords size={12} /> Competitive esports player</div>
            {gamer.bio && <p className="player-bio">{gamer.bio}</p>}
          </div>
          {/* A plain anchor, not a Link: the router would try to fetch this as a page. */}
          <a
            className="button button-primary"
            href={`/api/v1/gamers/${gamer.slug}/profile.pdf`}
            download={`${gamer.slug}-efightersarena-profile.pdf`}
          >
            <Download size={16} /> Download profile
          </a>
        </section>

        <section className="performance-grid">
          {showMatchStats ? (
            <>
              <article className="card performance-card"><Gamepad2 className="blue" /><span>Matches played</span><strong>{gamer.totals.played}</strong></article>
              <article className="card performance-card"><Trophy className="green" /><span>Won</span><strong>{gamer.totals.wins}</strong></article>
              <article className="card performance-card"><ShieldCheck /><span>Lost</span><strong>{gamer.totals.losses}</strong></article>
              <article className="card performance-card"><BadgeCheck className="blue" /><span>Ranking points</span><strong>{gamer.points.toLocaleString()}</strong></article>
            </>
          ) : (
            <>
              <article className="card performance-card"><Trophy className="green" /><span>Titles</span><strong>{gamer.totals.titles}</strong></article>
              <article className="card performance-card"><Award className="blue" /><span>Podium finishes</span><strong>{gamer.totals.podiums}</strong></article>
              <article className="card performance-card"><CalendarDays /><span>Events</span><strong>{gamer.totals.events}</strong></article>
              <article className="card performance-card"><Gamepad2 className="blue" /><span>Games</span><strong>{gamer.games.length}</strong></article>
            </>
          )}
        </section>

        <div className="profile-grid">
          <div className="card panel">
            {gamer.events.length === 0 && gamer.placements.length === 0 && (
              <>
                <h2 className="panel-title"><Trophy size={17} /> Competition record</h2>
                <div className="account-empty compact">
                  <h3>No public competitions yet</h3>
                  <p className="muted">Events appear here once this player is entered into a published tournament.</p>
                </div>
              </>
            )}

            {gamer.events.length > 0 && (
              <>
                <h2 className="panel-title"><Trophy size={17} /> Competition record</h2>
                <div className="table-scroll">
                  <table className="data-table player-results">
                    <thead><tr><th>Date</th><th>Event</th><th>Place</th><th>Record</th><th>Points</th></tr></thead>
                    <tbody>
                      {gamer.events.map((event) => (
                        <tr key={`${event.tournamentSlug}-${event.divisionName}`}>
                          <td><CalendarDays size={13} /> {formatDate(event.startsAt)}</td>
                          <td>
                            <Link href={`/tournaments/${event.tournamentSlug}`}><strong>{event.tournamentName}</strong></Link>
                            <div className="muted">{event.gameName} · {event.divisionName}</div>
                            <span className={`status ${event.status === "live" ? "live" : ""}`}>
                              {event.status === "live" && <span className="live-dot" />}{publicStatusLabel(event.status)}
                            </span>
                          </td>
                          <td><strong className={isTitle(event.rank) ? "green" : ""}>{placementLabel(event.rank)}</strong></td>
                          <td><strong>{event.wins}W</strong> · {event.losses}L{event.draws ? ` · ${event.draws}D` : ""}</td>
                          <td>{event.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {gamer.placements.length > 0 && (
              <>
                <h2 className="panel-title" style={{ marginTop: gamer.events.length > 0 ? 28 : 0 }}><Trophy size={17} /> Tournament results</h2>
                {gamer.placements.map((entry) => (
                  <div className="achievement" key={`${entry.tournamentSlug}-${entry.divisionName}-${entry.capturedAt}`}>
                    <div>
                      <Link href={`/tournaments/${entry.tournamentSlug}`}><strong>{entry.tournamentName}</strong></Link>
                      <div className="muted">{[entry.gameName, entry.year ? String(entry.year) : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="achievement-result">
                      <span className={`placement-medal ${placementMedalClass(entry.finalRank)}`}>
                        {placementBadge(entry.finalRank)}
                      </span>
                      <strong className={isTitle(entry.finalRank) ? "green" : undefined}>
                        {placementLabel(entry.finalRank, entry.placementLabel)}
                      </strong>
                    </div>
                  </div>
                ))}
              </>
            )}

            {achievementGroups.map((group) => (
              <div key={group.category}>
                <h2 className="panel-title" style={{ marginTop: 28 }}><group.icon size={17} /> {group.title}</h2>
                {group.items.map((entry) => (
                  <div className="achievement" key={`${group.category}-${entry.title}`}>
                    <div>
                      <strong>{entry.title}</strong>
                      {(entry.detail || entry.gameName) && (
                        <div className="muted">{[entry.detail, entry.gameName].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                    {entry.yearLabel && <span className="achievement-year">{entry.yearLabel}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <aside className="card panel">
            <h2 className="panel-title"><ShieldCheck size={17} /> Profile integrity</h2>
            <p className="muted">Identity, game handles and placements are reviewed by eFightersArena.</p>
            <div className="achievement"><span>Verification</span><strong className={gamer.verified ? "green" : undefined}>{gamer.verified ? "Verified" : "Unverified"}</strong></div>
            <div className="achievement"><span>Ranking points</span><strong className="green">{gamer.points.toLocaleString()}</strong></div>
            <div className="achievement"><span>Events entered</span><strong>{gamer.totals.events}</strong></div>
            <div className="achievement"><span>Titles won</span><strong>{gamer.totals.titles}</strong></div>
            <div className="achievement"><span>Podium finishes</span><strong>{gamer.totals.podiums}</strong></div>
            <div className="achievement"><span>Member since</span><strong>{gamer.memberSince}</strong></div>

            {gamer.games.length > 0 && (
              <>
                <h2 className="panel-title" style={{ marginTop: 24 }}><Gamepad2 size={17} /> Game identities</h2>
                {gamer.games.map((entry) => (
                  <div className="achievement" key={entry.game}>
                    <div><strong>{entry.game}</strong><div className="muted">{[entry.primaryRole, entry.platform].filter(Boolean).join(" · ") || "In-game name"}</div></div>
                    <strong>{entry.inGameName}</strong>
                  </div>
                ))}
              </>
            )}

            {gamer.teams.length > 0 && (
              <>
                <h2 className="panel-title" style={{ marginTop: 24 }}><Users size={17} /> Teams</h2>
                {gamer.teams.map((team) => (
                  <div className="achievement" key={team.slug}>
                    <div><strong>{team.name}</strong><div className="muted">{team.isLeader ? "Team leader" : team.role}</div></div>
                    <strong>{team.tag}</strong>
                  </div>
                ))}
              </>
            )}

            {gamer.sponsors.length > 0 && (
              <>
                <h2 className="panel-title" style={{ marginTop: 24 }}><Trophy size={17} /> Sponsors</h2>
                {gamer.sponsors.map((sponsor) => (
                  <div className="achievement" key={sponsor.name}>
                    <div><strong>{sponsor.name}</strong>{sponsor.category && <div className="muted">{sponsor.category}</div>}</div>
                    {sponsor.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- operator-uploaded logo served from our own media route
                      <img className="sponsor-logo" src={sponsor.logoUrl} alt={sponsor.name} height={28} />
                    )}
                  </div>
                ))}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
