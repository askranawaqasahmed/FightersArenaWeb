import { Trophy } from "lucide-react";
import { TournamentCard } from "@/components/tournament-card";
import { getPublicTournaments } from "@/lib/public-tournament-data";

export const metadata = { title: "Tournaments" };
export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const tournaments = await getPublicTournaments();
  const live = tournaments.filter((tournament) => tournament.status === "live");
  const upcoming = tournaments.filter((tournament) => ["published", "registration_open", "registration_closed"].includes(tournament.status));
  const completed = tournaments.filter((tournament) => tournament.status === "completed");

  return (
    <div className="page-shell">
      <div className="container">
        <div className="eyebrow">Competition central</div>
        <h1 className="page-title">Enter the bracket.<br /><span className="green">Earn your place.</span></h1>
        <p className="lede">Official registrations, schedules, group standings and live brackets—all connected to verified player histories.</p>
        {tournaments.length === 0 ? (
          <div className="card account-empty">
            <Trophy className="green" size={32} />
            <h2>No public competitions yet</h2>
            <p className="muted">Tournaments appear here as soon as an organizer publishes or starts them.</p>
          </div>
        ) : (
          <>
            {live.length > 0 && (
              <section aria-label="Live tournaments">
                <div className="section-header"><div><div className="eyebrow">Happening now</div><h2 className="panel-title">Live</h2></div></div>
                <div className="tournament-list">
                  {live.map((tournament) => <TournamentCard key={tournament.slug} tournament={tournament} />)}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section aria-label="Upcoming tournaments">
                <div className="section-header"><div><div className="eyebrow">Open and upcoming</div><h2 className="panel-title">Registering & upcoming</h2></div></div>
                <div className="tournament-list">
                  {upcoming.map((tournament) => <TournamentCard key={tournament.slug} tournament={tournament} />)}
                </div>
              </section>
            )}
            {completed.length > 0 && (
              <section aria-label="Completed tournaments">
                <div className="section-header"><div><div className="eyebrow">Archive</div><h2 className="panel-title">Completed</h2></div></div>
                <div className="tournament-list">
                  {completed.map((tournament) => <TournamentCard key={tournament.slug} tournament={tournament} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
