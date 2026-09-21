import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { AdminTournamentRows } from "@/components/admin-tournament-rows";
import { getAdminEventsFromDatabase } from "@/lib/admin-tournament-data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Manage Competitions" };

export default async function AdminTournamentsPage() {
  const events = await getAdminEventsFromDatabase();
  return <main className="admin-content"><div className="section-header"><div><h1 className="admin-heading">Events</h1><p className="admin-subtitle">Group multiple game tournaments and leagues under a single event.</p></div><Link className="button button-primary" href="/admin/tournaments/new"><CalendarPlus size={16} /> New event</Link></div><section className="card panel table-scroll"><table className="data-table"><thead><tr><th>Event</th><th>Competitions</th><th>Dates</th><th>Status</th><th /></tr></thead><tbody><AdminTournamentRows initialEvents={events} /></tbody></table></section></main>;
}
