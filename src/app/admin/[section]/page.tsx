import { Activity, BarChart3, ShieldCheck, Users } from "lucide-react";
import { ContentStudio } from "@/components/content-studio";
import { GameCatalogManager } from "@/components/game-catalog-manager";
import { tournaments } from "@/lib/demo-data";

const teams = [
  ["Team Cipher", "CIP", "Karachi", "5 active", "Verified"],
  ["Northwind", "NTW", "Lahore", "7 active", "Verified"],
  ["Riftwalkers", "RFT", "Islamabad", "5 active", "Pending"],
  ["Aegis Pakistan", "AGS", "Peshawar", "6 active", "Verified"],
];

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h1 className="admin-heading">{title}</h1><p className="admin-subtitle">{subtitle}</p></div>;
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (section === "teams") return <main className="admin-content"><SectionHeader title="Teams" subtitle="Review organizations, leaders, roster history and eligibility." /><section className="card panel" style={{ marginTop: 28 }}><table className="data-table"><thead><tr><th>Team</th><th>Tag</th><th>City</th><th>Roster</th><th>Status</th></tr></thead><tbody>{teams.map((team) => <tr key={team[1]}><td><strong><ShieldCheck className="verified" size={13} /> {team[0]}</strong></td><td>{team[1]}</td><td>{team[2]}</td><td>{team[3]}</td><td><span className="status">{team[4].toUpperCase()}</span></td></tr>)}</tbody></table></section></main>;

  if (section === "games") return <GameCatalogManager />;

  if (section === "content") return <ContentStudio />;

  if (section === "reports") return <main className="admin-content"><SectionHeader title="Reports" subtitle="Monitor national growth, competition health and verification throughput." /><section className="admin-stats"><div className="card admin-stat"><Users className="green" /><div className="stat-value">+18%</div><div className="stat-label">Gamer growth</div></div><div className="card admin-stat"><BarChart3 className="blue" /><div className="stat-value">74%</div><div className="stat-label">Profile completion</div></div><div className="card admin-stat"><ShieldCheck className="green" /><div className="stat-value">91%</div><div className="stat-label">Verification SLA</div></div><div className="card admin-stat"><Activity className="blue" /><div className="stat-value">99.9%</div><div className="stat-label">Result integrity</div></div></section><section className="card panel"><h2 className="panel-title">Tournament portfolio</h2>{tournaments.map((tournament) => <div className="achievement" key={tournament.slug}><div><strong>{tournament.name}</strong><div className="muted">{tournament.game}</div></div><strong>{tournament.progress}% complete</strong></div>)}</section></main>;

  return <main className="admin-content"><SectionHeader title="Workspace" subtitle="The requested module is not available." /><section className="card panel" style={{ marginTop: 28 }}>Unknown admin section.</section></main>;
}
