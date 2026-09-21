import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { BadgeCheck, CalendarDays, Gamepad2, MapPin, ShieldCheck, Trophy } from "lucide-react";
import { db } from "@/db/client";
import {
  cities,
  countries,
  divisions,
  gamerGames,
  gamerProfiles,
  games,
  registrations,
  stages,
  standings,
  tournaments,
} from "@/db/schema";
import { requireGamer } from "@/lib/gamer-auth";
import { placementLabel } from "@/lib/placement";
import { ProfilePhotoUploader } from "@/components/profile-photo-uploader";

const placement = (rank: number | null) => placementLabel(rank);

function formatDate(value: Date | null) {
  return value?.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) ?? "Date TBA";
}

export default async function DashboardPage() {
  const account = await requireGamer();
  const [profile] = await db
    .select({
      id: gamerProfiles.id,
      displayName: gamerProfiles.displayName,
      handle: gamerProfiles.handle,
      bio: gamerProfiles.bio,
      rankingPoints: gamerProfiles.rankingPoints,
      verificationStatus: gamerProfiles.verificationStatus,
      avatarUrl: gamerProfiles.avatarUrl,
      createdAt: gamerProfiles.createdAt,
      city: cities.name,
      country: countries.name,
      game: games.name,
      inGameName: gamerGames.inGameName,
    })
    .from(gamerProfiles)
    .leftJoin(cities, eq(cities.id, gamerProfiles.cityId))
    .leftJoin(countries, eq(countries.id, gamerProfiles.countryId))
    .leftJoin(gamerGames, eq(gamerGames.gamerId, gamerProfiles.id))
    .leftJoin(games, eq(games.id, gamerGames.gameId))
    .where(eq(gamerProfiles.userId, account.userId))
    .limit(1);

  if (!profile) {
    return (
      <main className="account-content container">
        <section className="card account-empty">
          <ShieldCheck className="green" size={32} />
          <h1>Your player account is ready.</h1>
          <p className="muted">
            Your mobile identity is verified. An administrator still needs to connect your
            competitive profile before results and event history appear here.
          </p>
          <Link className="button button-secondary" href="/gamers">Browse player rankings</Link>
        </section>
      </main>
    );
  }

  const rows = await db
    .select({
      registrationId: registrations.id,
      eventName: tournaments.name,
      competitionType: tournaments.competitionType,
      startsAt: tournaments.startsAt,
      divisionName: divisions.name,
      gameName: games.name,
      rank: standings.rank,
      played: standings.played,
      wins: standings.wins,
      draws: standings.draws,
      losses: standings.losses,
      points: standings.points,
    })
    .from(registrations)
    .innerJoin(divisions, eq(divisions.id, registrations.divisionId))
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .leftJoin(stages, eq(stages.divisionId, divisions.id))
    .leftJoin(standings, and(eq(standings.stageId, stages.id), eq(standings.participantId, profile.id)))
    .where(and(eq(registrations.participantId, profile.id), eq(registrations.participantType, "gamer")))
    .orderBy(desc(tournaments.startsAt));

  const eventMap = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const current = eventMap.get(row.registrationId);
    if (!current) {
      eventMap.set(row.registrationId, row);
      continue;
    }
    eventMap.set(row.registrationId, {
      ...current,
      rank: current.rank && row.rank ? Math.min(current.rank, row.rank) : current.rank ?? row.rank,
      played: (current.played ?? 0) + (row.played ?? 0),
      wins: (current.wins ?? 0) + (row.wins ?? 0),
      draws: (current.draws ?? 0) + (row.draws ?? 0),
      losses: (current.losses ?? 0) + (row.losses ?? 0),
      points: (current.points ?? 0) + (row.points ?? 0),
    });
  }

  const events = [...eventMap.values()];
  const totals = events.reduce((total, event) => ({
    played: total.played + (event.played ?? 0),
    wins: total.wins + (event.wins ?? 0),
    losses: total.losses + (event.losses ?? 0),
    leagues: total.leagues + (event.competitionType === "league" ? 1 : 0),
  }), { played: 0, wins: 0, losses: 0, leagues: 0 });
  const initials = profile.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="account-content container">
      <section className="card player-summary">
        <ProfilePhotoUploader currentUrl={profile.avatarUrl} initials={initials} />
        <div className="player-summary-main">
          <div className="eyebrow">My player profile</div>
          <h1>
            {profile.handle}
            {profile.verificationStatus === "verified" && <BadgeCheck className="verified" size={22} />}
          </h1>
          <p className="muted">
            {profile.displayName} · <MapPin size={13} /> {[profile.city, profile.country].filter(Boolean).join(", ")} · {profile.game ?? "Game not assigned"}
          </p>
          <p className="player-bio">{profile.bio ?? "No player bio has been added yet."}</p>
        </div>
        <div className="player-identity">
          <span>Player since</span><strong>{profile.createdAt.getFullYear()}</strong>
          <span>In-game ID</span><strong>{profile.inGameName ?? profile.handle}</strong>
          <span>{account.email ? "Email" : "Mobile"}</span><strong>{account.email ?? account.phone ?? "—"}</strong>
        </div>
      </section>

      <section className="performance-grid">
        <article className="card performance-card"><Gamepad2 className="blue" /><span>Matches played</span><strong>{totals.played}</strong></article>
        <article className="card performance-card"><Trophy className="green" /><span>Won</span><strong>{totals.wins}</strong></article>
        <article className="card performance-card"><ShieldCheck /><span>Lost</span><strong>{totals.losses}</strong></article>
        <article className="card performance-card"><BadgeCheck className="blue" /><span>Ranking points</span><strong>{profile.rankingPoints.toLocaleString()}</strong></article>
      </section>

      <section className="card panel participation-panel">
        <div className="section-header">
          <div><div className="eyebrow">Competitive record</div><h2 className="panel-title">Tournaments & leagues</h2></div>
          <div className="participation-count"><strong>{events.length}</strong> events · <strong>{totals.leagues}</strong> leagues</div>
        </div>
        {events.length ? (
          <div className="table-scroll">
            <table className="data-table player-results">
              <thead><tr><th>Date</th><th>Type</th><th>Event</th><th>Place</th><th>Record</th><th>Points</th></tr></thead>
              <tbody>
                {events.map((event) => {
                  const isLeague = event.competitionType === "league";
                  return (
                    <tr key={event.registrationId}>
                      <td><CalendarDays size={13} /> {formatDate(event.startsAt)}</td>
                      <td><span className={`status ${isLeague ? "league" : ""}`}>{isLeague ? "LEAGUE" : "TOURNAMENT"}</span></td>
                      <td><strong>{event.eventName}</strong><div className="muted">{event.gameName} · {event.divisionName}</div></td>
                      <td><strong className={event.rank === 1 ? "green" : ""}>{placement(event.rank)}</strong></td>
                      <td><strong>{event.wins ?? 0}W</strong> · {event.losses ?? 0}L{event.draws ? ` · ${event.draws}D` : ""}</td>
                      <td>{event.points ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="account-empty compact"><Trophy className="green" /><h3>No competition history yet</h3><p className="muted">Your registered tournaments and leagues will appear here once an organizer adds you.</p></div>
        )}
      </section>
    </main>
  );
}
