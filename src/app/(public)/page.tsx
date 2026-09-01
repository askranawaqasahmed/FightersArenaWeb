import Link from "next/link";
import { BadgeCheck, TrendingUp } from "lucide-react";
import { HomepageHero, PublishedContentSection } from "@/components/homepage-managed-content";
import { ManagedGameGrid } from "@/components/managed-game-directory";
import { SectionHeader } from "@/components/section-header";
import { TournamentCard } from "@/components/tournament-card";
import { platformStats, sponsorsData } from "@/lib/demo-data";
import { getPublicGamers } from "@/lib/public-gamer-data";
import { getPublicTournaments } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Real operator-created records, so every card links to a page that actually exists.
  const [tournaments, featuredGamers] = await Promise.all([
    getPublicTournaments().then((rows) => rows.slice(0, 3)),
    getPublicGamers().then((rows) => rows.slice(0, 5)),
  ]);
  return (
    <>
      <HomepageHero />

      <div className="container stats-strip"><div className="stats-grid">{platformStats.map((stat) => <div className="stat" key={stat.label}><div className="stat-value">{stat.value}</div><div className="stat-label">{stat.label}</div><div className="stat-delta"><TrendingUp size={11} /> {stat.delta}</div></div>)}</div></div>

      <section className="section"><div className="container"><SectionHeader eyebrow="Game directory" title="Choose your arena" href="/games" />
        <ManagedGameGrid />
      </div></section>

      <section className="section section-tinted"><div className="container"><SectionHeader eyebrow="Competition central" title="Live and upcoming" href="/tournaments" />
        {tournaments.length > 0
          ? <div className="tournament-list">{tournaments.map((tournament) => <TournamentCard key={tournament.slug} tournament={tournament} />)}</div>
          : <p className="muted">No public competitions yet. Published and live events appear here automatically.</p>}
      </div></section>

      <PublishedContentSection />

      <section className="section" id="rankings"><div className="container"><SectionHeader eyebrow="National rankings" title="Players to watch" href="/gamers" />
        {featuredGamers.length > 0
          ? <div className="leaderboard">{featuredGamers.map((gamer) => <Link className="card gamer-card" href={`/gamers/${gamer.slug}`} key={gamer.slug}><div className="gamer-rank">#{gamer.rank}</div><div className="avatar">{gamer.initials}</div><div className="gamer-handle">{gamer.handle} {gamer.verified && <BadgeCheck className="verified" size={16} />}</div><div className="gamer-name">{[gamer.name, gamer.city].filter(Boolean).join(" · ")}</div><div className="gamer-meta"><span>{gamer.game ?? ""}</span><strong className="green">{gamer.points.toLocaleString()} pts</strong></div></Link>)}</div>
          : <p className="muted">No public player profiles yet. Verified players appear here automatically.</p>}
      </div></section>

      <div className="sponsor-strip"><div className="container sponsors"><span className="eyebrow">Trusted by</span>{sponsorsData.map((sponsor) => <span key={sponsor}>{sponsor}</span>)}</div></div>
    </>
  );
}
