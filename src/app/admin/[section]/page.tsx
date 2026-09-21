import Link from "next/link";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { Activity, BarChart3, Gamepad2, ShieldCheck, Users } from "lucide-react";
import { db } from "@/db/client";
import { countries, gamerProfiles, teamMemberships, teams, tournaments } from "@/db/schema";
import { ContentStudio } from "@/components/content-studio";
import { GameCatalogManager } from "@/components/game-catalog-manager";
import { listAdminGames } from "@/lib/game-data";
import { getAdminEventsFromDatabase } from "@/lib/admin-tournament-data";
import { publicTournamentStatuses } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="admin-heading">{title}</h1><p className="admin-subtitle">{subtitle}</p></div>;
}

async function TeamsSection() {
  const rows = await db.select({
    id: teams.id,
    name: teams.name,
    tag: teams.tag,
    country: countries.name,
    verificationStatus: teams.verificationStatus,
  })
    .from(teams)
    .leftJoin(countries, eq(countries.id, teams.countryId))
    .orderBy(asc(teams.name));

  const memberRows = rows.length > 0
    ? await db.select({ teamId: teamMemberships.teamId, value: count() })
      .from(teamMemberships)
      .where(and(inArray(teamMemberships.teamId, rows.map((row) => row.id)), eq(teamMemberships.status, "active")))
      .groupBy(teamMemberships.teamId)
    : [];
  const membersByTeam = new Map(memberRows.map((row) => [row.teamId, Number(row.value)]));

  return <main className="admin-content">
    <SectionHeader title="Teams" subtitle="Review organizations, leaders, roster history and eligibility." />
    <section className="card panel" style={{ marginTop: 28 }}>
      {rows.length === 0 ? (
        <div className="account-empty compact"><Users className="green" /><h2>No teams yet</h2><p className="muted">Teams appear here once they are created for a team competition.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Team</th><th>Tag</th><th>Country</th><th>Roster</th><th>Status</th></tr></thead>
          <tbody>{rows.map((team) => <tr key={team.id}>
            <td><strong>{team.verificationStatus === "verified" && <ShieldCheck className="verified" size={13} />} {team.name}</strong></td>
            <td>{team.tag}</td>
            <td>{team.country ?? "—"}</td>
            <td>{membersByTeam.get(team.id) ?? 0} active</td>
            <td><span className="status">{team.verificationStatus.toUpperCase()}</span></td>
          </tr>)}</tbody>
        </table>
      )}
    </section>
  </main>;
}

async function ReportsSection() {
  const [players, publishedEvents, events] = await Promise.all([
    db.select({ value: count() }).from(gamerProfiles),
    db.select({ value: count() }).from(tournaments).where(inArray(tournaments.status, [...publicTournamentStatuses])),
    getAdminEventsFromDatabase(),
  ]);
  const verified = await db.select({ value: count() }).from(gamerProfiles).where(eq(gamerProfiles.verificationStatus, "verified"));
  const playerCount = Number(players[0]?.value ?? 0);
  const verifiedCount = Number(verified[0]?.value ?? 0);

  return <main className="admin-content">
    <SectionHeader title="Reports" subtitle="Monitor national growth, competition health and verification throughput." />
    <section className="admin-stats">
      <div className="card admin-stat"><Users className="green" /><div className="stat-value">{playerCount}</div><div className="stat-label">Player profiles</div></div>
      <div className="card admin-stat"><ShieldCheck className="green" /><div className="stat-value">{verifiedCount}</div><div className="stat-label">Verified players</div></div>
      <div className="card admin-stat"><BarChart3 className="blue" /><div className="stat-value">{Number(publishedEvents[0]?.value ?? 0)}</div><div className="stat-label">Public competitions</div></div>
      <div className="card admin-stat"><Activity className="blue" /><div className="stat-value">{events.length}</div><div className="stat-label">Total events</div></div>
    </section>
    <section className="card panel">
      <h2 className="panel-title">Tournament portfolio</h2>
      {events.length === 0
        ? <p className="muted">No events yet. Create one from <Link className="text-link" href="/admin/tournaments/new">the tournament builder</Link>.</p>
        : events.map((event) => (
          <div className="achievement" key={event.slug}>
            <div>
              <strong>{event.name}</strong>
              <div className="muted">{event.competitions.map((competition) => competition.game).join(", ") || "No competitions yet"}</div>
            </div>
            <span className="status">{event.status}</span>
          </div>
        ))}
    </section>
  </main>;
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (section === "teams") return TeamsSection();

  if (section === "games") {
    const games = await listAdminGames();
    return <GameCatalogManager games={games} />;
  }

  if (section === "content") return <ContentStudio />;

  if (section === "reports") return ReportsSection();

  return <main className="admin-content">
    <SectionHeader title="Workspace" subtitle="The requested module is not available." />
    <section className="card panel" style={{ marginTop: 28 }}><Gamepad2 size={16} /> Unknown admin section.</section>
  </main>;
}
