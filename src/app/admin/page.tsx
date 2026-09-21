import Link from "next/link";
import { count, eq, inArray } from "drizzle-orm";
import { ArrowUpRight, CalendarPlus, Gamepad2, ShieldCheck, Trophy, Users } from "lucide-react";
import { db } from "@/db/client";
import { gamerProfiles, games, tournaments } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminEventsFromDatabase } from "@/lib/admin-tournament-data";
import { publicTournamentStatuses } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin Dashboard" };

const ACTIVE_STATUSES = ["published", "registration_open", "registration_closed", "live"] as const;

export default async function AdminDashboard() {
  const actor = await requireAdmin();
  const [players, pending, activeEvents, publicEvents, gameCount, events] = await Promise.all([
    db.select({ value: count() }).from(gamerProfiles),
    db.select({ value: count() }).from(gamerProfiles).where(eq(gamerProfiles.verificationStatus, "pending")),
    db.select({ value: count() }).from(tournaments).where(inArray(tournaments.status, [...ACTIVE_STATUSES])),
    db.select({ value: count() }).from(tournaments).where(inArray(tournaments.status, [...publicTournamentStatuses])),
    db.select({ value: count() }).from(games).where(eq(games.active, true)),
    getAdminEventsFromDatabase(),
  ]);

  const stats = [
    { label: "Player profiles", value: Number(players[0]?.value ?? 0), icon: Users },
    { label: "Awaiting verification", value: Number(pending[0]?.value ?? 0), icon: ShieldCheck },
    { label: "Active events", value: Number(activeEvents[0]?.value ?? 0), icon: Trophy },
    { label: "Games", value: Number(gameCount[0]?.value ?? 0), icon: Gamepad2 },
  ];
  const recentEvents = events.slice(0, 6);
  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" });

  return (
    <main className="admin-content">
      <div>
        <div className="eyebrow">{today}</div>
        <h1 className="admin-heading">{actor.email}</h1>
        <p className="admin-subtitle">Here is what is on the platform right now.</p>
      </div>

      <section className="admin-stats">
        {stats.map((stat) => (
          <div className="card admin-stat" key={stat.label}>
            <stat.icon className="green" />
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="card panel">
        <div className="section-header">
          <div>
            <div className="eyebrow">Operations</div>
            <h2 className="panel-title" style={{ marginTop: 7 }}>Events</h2>
          </div>
          <Link className="text-link" href="/admin/tournaments">Manage <ArrowUpRight size={14} /></Link>
        </div>
        {recentEvents.length === 0 ? (
          <div className="account-empty compact">
            <CalendarPlus className="green" />
            <h3>No events yet</h3>
            <p className="muted">Create your first event to start taking entries.</p>
            <Link className="button button-primary" href="/admin/tournaments/new">Create an event</Link>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Event</th><th>Status</th><th>Competitions</th><th /></tr></thead>
            <tbody>{recentEvents.map((event) => (
              <tr key={event.slug}>
                <td><strong>{event.name}</strong><div className="muted">{event.date}</div></td>
                <td><span className={`status ${event.status === "LIVE" ? "live" : ""}`}>{event.status}</span></td>
                <td>{event.competitions.map((competition) => competition.game).join(", ") || "—"}</td>
                <td><Link className="text-link" href={`/admin/tournaments/${event.slug}`}>Open</Link></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        <p className="helper">{Number(publicEvents[0]?.value ?? 0)} events are visible on the public site.</p>
      </section>
    </main>
  );
}
