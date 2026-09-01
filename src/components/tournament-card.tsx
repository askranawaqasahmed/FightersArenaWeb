import Link from "next/link";
import { ArrowRight, CalendarDays, Trophy } from "lucide-react";

type Tournament = {
  slug: string;
  name: string;
  game: string;
  status: string;
  date: string;
  teams: number;
  prize?: string;
  format: string;
  progress: number;
};

export function TournamentCard({ tournament }: { tournament: Tournament }) {
  return (
    <Link className="card tournament-card" href={`/tournaments/${tournament.slug}`}>
      <div>
        <span className={`status ${tournament.status === "LIVE" ? "live" : ""}`}>{tournament.status === "LIVE" && <span className="live-dot" />}{tournament.status}</span>
        <div className="tournament-name">{tournament.name}</div>
        <div className="progress" aria-label={`${tournament.progress}% complete`}><span style={{ width: `${tournament.progress}%` }} /></div>
      </div>
      <div className="tournament-meta"><strong className="green">{tournament.game}</strong><br />{tournament.format}</div>
      <div className="tournament-meta"><CalendarDays size={13} /> {tournament.date}{tournament.prize && <><br /><Trophy size={13} /> {tournament.prize}</>}</div>
      <div><strong>{tournament.teams}</strong> participants <ArrowRight size={16} /></div>
    </Link>
  );
}
