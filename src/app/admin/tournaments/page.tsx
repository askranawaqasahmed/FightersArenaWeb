import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { AdminTournamentRows } from "@/components/admin-tournament-rows";
import { adminEvents } from "@/lib/admin-events";
import { getAdminEventsFromDatabase } from "@/lib/admin-tournament-data";

export const metadata = { title: "Manage Competitions" };

export default async function AdminTournamentsPage() {
  const databaseEvents = await getAdminEventsFromDatabase();
  const databaseSlugs = new Set(databaseEvents.map((event) => event.slug));
  const events = [...databaseEvents, ...adminEvents.filter((event) => !databaseSlugs.has(event.slug))];
  return <main className="admin-content"><div className="section-header"><div><h1 className="admin-heading">Events</h1><p className="admin-subtitle">Group multiple game tournaments and leagues under a single event.</p></div><Link className="button button-primary" href="/admin/tournaments/new"><CalendarPlus size={16} /> New event</Link></div><section className="card panel table-scroll"><table className="data-table"><thead><tr><th>Event</th><th>Competitions</th><th>Dates</th><th>Status</th><th /></tr></thead><tbody><AdminTournamentRows initialEvents={events} /></tbody></table></section></main>;
}
