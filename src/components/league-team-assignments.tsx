"use client";

import type { LeagueTeamDraft } from "@/lib/tournament-draft";

const playerOptions = [
  ["nova", "NOVA", "Ayaan Khan"],
  ["viper", "VIPER", "Hassan Raza"],
  ["raven", "RAVEN", "Sara Malik"],
  ["frost", "FROST", "Ali Noor"],
  ["cipher", "CIPHER", "Hamza Ahmed"],
  ["volt", "VOLT", "Zain Shah"],
  ["aegis", "AEGIS", "Mariam Iqbal"],
  ["orbit", "ORBIT", "Usman Tariq"],
  ["ember", "EMBER", "Hira Khan"],
  ["zenith", "ZENITH", "Bilal Akram"],
] as const;

type LeagueTeamAssignmentsProps = {
  teams: LeagueTeamDraft[];
  playersPerTeam: number;
  onChange: (teams: LeagueTeamDraft[]) => void;
};

export function LeagueTeamAssignments({ teams, playersPerTeam, onChange }: LeagueTeamAssignmentsProps) {
  function updateTeam(id: string, changes: Partial<LeagueTeamDraft>) {
    onChange(teams.map((team) => team.id === id ? { ...team, ...changes } : team));
  }

  function assignLeader(team: LeagueTeamDraft, leaderId: string) {
    const otherPlayers = team.playerIds.filter((playerId) => playerId !== leaderId);
    const playerIds = leaderId ? [leaderId, ...otherPlayers].slice(0, playersPerTeam) : otherPlayers;
    updateTeam(team.id, { leaderId, playerIds });
  }

  function togglePlayer(team: LeagueTeamDraft, playerId: string) {
    if (playerId === team.leaderId) return;
    const isAssigned = team.playerIds.includes(playerId);
    const playerIds = isAssigned
      ? team.playerIds.filter((assignedId) => assignedId !== playerId)
      : [...team.playerIds, playerId].slice(0, playersPerTeam);
    updateTeam(team.id, { playerIds });
  }

  return (
    <section className="league-assignment-section">
      <div className="section-header stage-header">
        <div><h2 className="panel-title">League team assignments</h2><p className="helper">The superadmin assigns each roster. Players will see their pending team in the mobile app and must confirm before the league can start.</p></div>
      </div>
      <div className="activity">
        {teams.map((team, index) => {
          const rosterFull = team.playerIds.length >= playersPerTeam;
          const readyForConfirmation = Boolean(team.leaderId) && team.playerIds.length === playersPerTeam;
          return (
            <article className="card panel league-team-card" key={team.id}>
              <div className="section-header stage-header">
                <div><span className="status">TEAM {index + 1}</span><h3>{team.name}</h3></div>
                <span className="status">{readyForConfirmation ? "AWAITING CONFIRMATION" : "CONFIGURATION PENDING"}</span>
              </div>
              <div className="builder-grid">
                <label className="form-group"><span className="form-label">Team name</span><input className="input" value={team.name} onChange={(event) => updateTeam(team.id, { name: event.target.value })} /></label>
                <label className="form-group"><span className="form-label">Team leader</span><select className="select" value={team.leaderId} onChange={(event) => assignLeader(team, event.target.value)}><option value="">Select leader</option>{playerOptions.map(([id, handle, name]) => <option value={id} key={id}>{handle} · {name}</option>)}</select></label>
              </div>
              <fieldset className="player-assignment-list">
                <legend className="form-label">Assigned players ({team.playerIds.length}/{playersPerTeam})</legend>
                {playerOptions.map(([id, handle, name]) => {
                  const isAssigned = team.playerIds.includes(id);
                  const isLeader = team.leaderId === id;
                  return <label className="player-assignment" key={id}><input type="checkbox" checked={isAssigned} disabled={isLeader || (!isAssigned && rosterFull)} onChange={() => togglePlayer(team, id)} /><span><strong>{handle}</strong> · {name}{isLeader ? " · Leader" : ""}</span></label>;
                })}
              </fieldset>
            </article>
          );
        })}
      </div>
    </section>
  );
}
