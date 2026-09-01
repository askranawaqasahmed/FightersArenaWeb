"use client";

import { useState } from "react";
import { BracketView } from "./bracket-view";

const tabs = ["Overview", "Bracket", "Groups", "Matches", "Teams"] as const;
type Tab = (typeof tabs)[number];

const groups = [
  { name: "Team Cipher", played: 3, wins: 3, losses: 0, score: "6–1", points: 9 },
  { name: "Northwind", played: 3, wins: 2, losses: 1, score: "5–3", points: 6 },
  { name: "Aegis", played: 3, wins: 1, losses: 2, score: "3–5", points: 3 },
  { name: "Orbit", played: 3, wins: 0, losses: 3, score: "1–6", points: 0 },
];

const matches = [
  { code: "QF3", pairing: "Riftwalkers vs Orbit", time: "Live now", score: "1–1", state: "LIVE" },
  { code: "QF4", pairing: "Zenith vs Ember", time: "Today, 19:00", score: "—", state: "READY" },
  { code: "SF1", pairing: "Cipher vs Volt", time: "Tomorrow, 17:00", score: "—", state: "SCHEDULED" },
  { code: "SF2", pairing: "TBD vs TBD", time: "Tomorrow, 20:00", score: "—", state: "PENDING" },
];

const teams = ["Team Cipher", "Northwind", "Riftwalkers", "Orbit", "Volt", "Aegis", "Zenith", "Ember"];

export function TournamentTabs({ format, progress }: { format: string; progress: number }) {
  const [activeTab, setActiveTab] = useState<Tab>("Bracket");

  return (
    <>
      <div className="tab-list" role="tablist" aria-label="Tournament sections">
        {tabs.map((tab) => (
          <button
            className={`filter-chip ${activeTab === tab ? "active" : ""}`}
            id={`tab-${tab.toLowerCase()}`}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`panel-${tab.toLowerCase()}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="tab-panel section-compact" role="tabpanel" id={`panel-${activeTab.toLowerCase()}`} aria-labelledby={`tab-${activeTab.toLowerCase()}`}>
        {activeTab === "Overview" && (
          <div className="profile-grid">
            <div className="card panel"><div className="eyebrow">Competition format</div><h2 className="section-title">{format}</h2><p className="lede">Teams advance through verified match results. Locked stages preserve seeding, scoring and every downstream path.</p></div>
            <aside className="card panel"><h2 className="panel-title">Tournament progress</h2><div className="stat-value">{progress}%</div><div className="progress"><span style={{ width: `${progress}%` }} /></div><p className="muted">Results update the bracket and player profiles automatically.</p></aside>
          </div>
        )}

        {activeTab === "Bracket" && (
          <><div className="section-header"><div><div className="eyebrow">Playoffs · Best of 3</div><h2 className="section-title">Championship bracket</h2></div><span className="muted">Last updated 2 minutes ago</span></div><BracketView format={format} /></>
        )}

        {activeTab === "Groups" && (
          <><div className="section-header"><div><div className="eyebrow">Stage one</div><h2 className="section-title">Group standings</h2></div><span className="muted">Top two advance</span></div><div className="card panel table-scroll"><table className="data-table"><thead><tr><th>Rank</th><th>Team</th><th>Played</th><th>Wins</th><th>Losses</th><th>Score</th><th>Points</th></tr></thead><tbody>{groups.map((team, index) => <tr key={team.name}><td><strong>#{index + 1}</strong></td><td><strong>{team.name}</strong></td><td>{team.played}</td><td>{team.wins}</td><td>{team.losses}</td><td>{team.score}</td><td><strong className="green">{team.points}</strong></td></tr>)}</tbody></table></div></>
        )}

        {activeTab === "Matches" && (
          <><div className="section-header"><div><div className="eyebrow">Match centre</div><h2 className="section-title">Schedule and results</h2></div><span className="muted">All times Asia/Karachi</span></div><div className="card panel table-scroll"><table className="data-table"><thead><tr><th>Match</th><th>Pairing</th><th>Time</th><th>Score</th><th>Status</th></tr></thead><tbody>{matches.map((match) => <tr key={match.code}><td><strong>{match.code}</strong></td><td>{match.pairing}</td><td>{match.time}</td><td>{match.score}</td><td><span className={`status ${match.state === "LIVE" ? "live" : ""}`}>{match.state}</span></td></tr>)}</tbody></table></div></>
        )}

        {activeTab === "Teams" && (
          <><div className="section-header"><div><div className="eyebrow">Qualified field</div><h2 className="section-title">Competing teams</h2></div><span className="muted">8 playoff teams</span></div><div className="game-grid">{teams.map((team, index) => <article className="card panel team-tile" key={team}><div className="avatar">{team.split(" ").map((word) => word[0]).join("").slice(0, 2)}</div><div><h3>{team}</h3><p className="muted">Seed #{index + 1} · Verified roster</p></div></article>)}</div></>
        )}
      </section>
    </>
  );
}
