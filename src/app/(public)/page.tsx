import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { gamerProfiles, games, sponsors, tournaments } from "@/db/schema";
import { HomepageHero, PublishedContentSection } from "@/components/homepage-managed-content";
import { ManagedGameGrid } from "@/components/managed-game-directory";
import { SectionHeader } from "@/components/section-header";
import { TournamentCard } from "@/components/tournament-card";
import { getGames } from "@/lib/game-data";
import { getPublicGamers } from "@/lib/public-gamer-data";
import { getPublicTournaments, publicTournamentStatuses } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

async function platformCounts() {
  const [players, events, gameCount, sponsorRows] = await Promise.all([
    db.select({ value: count() }).from(gamerProfiles).where(eq(gamerProfiles.profileVisibility, "public")),
    db.select({ value: count() }).from(tournaments).where(inArray(tournaments.status, [...publicTournamentStatuses])),
    db.select({ value: count() }).from(games).where(eq(games.active, true)),
    db.select({ name: sponsors.name }).from(sponsors),
  ]);
  return {
    players: Number(players[0]?.value ?? 0),
    events: Number(events[0]?.value ?? 0),
    games: Number(gameCount[0]?.value ?? 0),
    sponsors: sponsorRows.map((row) => row.name),
  };
}

export default async function HomePage() {
  // Real operator-created records, so every card links to a page that actually exists.
  const [tournamentRows, featuredGamers, gameRows, counts] = await Promise.all([
    getPublicTournaments().then((rows) => rows.slice(0, 3)),
    getPublicGamers().then((rows) => rows.slice(0, 5)),
    getGames(),
    platformCounts(),
  ]);

  const stats = [
    { label: "Registered players", value: counts.players.toLocaleString() },
    { label: "Competitions", value: counts.events.toLocaleString() },
    { label: "Games", value: counts.games.toLocaleString() },
  ];

  return (
    <>
      <HomepageHero />

      <div className="container stats-strip"><div className="stats-grid">{stats.map((stat) => <div className="stat" key={stat.label}><div className="stat-value">{stat.value}</div><div className="stat-label">{stat.label}</div></div>)}</div></div>

      <section className="section"><div className="container"><SectionHeader eyebrow="Game directory" title="Choose your arena" href="/games" />
        {gameRows.length > 0
          ? <ManagedGameGrid games={gameRows.slice(0, 8)} />
          : <p className="muted">No games in the catalogue yet.</p>}
      </div></section>

      <section className="section section-tinted"><div className="container"><SectionHeader eyebrow="Competition central" title="Live and upcoming" href="/tournaments" />
        {tournamentRows.length > 0
          ? <div className="tournament-list">{tournamentRows.map((tournament) => <TournamentCard key={tournament.slug} tournament={tournament} />)}</div>
          : <p className="muted">No public competitions yet. Published and live events appear here automatically.</p>}
      </div></section>

      <PublishedContentSection />

      <section className="section" id="rankings"><div className="container"><SectionHeader eyebrow="National rankings" title="Players to watch" href="/gamers" />
        {featuredGamers.length > 0
          ? <div className="leaderboard">{featuredGamers.map((gamer) => <Link className="card gamer-card" href={`/gamers/${gamer.slug}`} key={gamer.slug}><div className="gamer-rank">#{gamer.rank}</div><div className="avatar">{gamer.initials}</div><div className="gamer-handle">{gamer.handle} {gamer.verified && <BadgeCheck className="verified" size={16} />}</div><div className="gamer-name">{[gamer.name, gamer.city].filter(Boolean).join(" · ")}</div><div className="gamer-meta"><span>{gamer.game ?? ""}</span><strong className="green">{gamer.points.toLocaleString()} pts</strong></div></Link>)}</div>
          : <p className="muted">No public player profiles yet. Verified players appear here automatically.</p>}
      </div></section>

      {counts.sponsors.length > 0 && (
        <div className="sponsor-strip"><div className="container sponsors"><span className="eyebrow">Trusted by</span>{counts.sponsors.map((sponsor) => <span key={sponsor}>{sponsor}</span>)}</div></div>
      )}
    </>
  );
}
