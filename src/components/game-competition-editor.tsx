"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import { defaultManagedGames, gameCatalogChangeEvent, gameCatalogStorageKey, type ManagedGame } from "./game-catalog-manager";
import { LeagueTeamAssignments } from "./league-team-assignments";
import { TournamentStagePipeline } from "./tournament-stage-pipeline";
import { createLeagueTeam, type GameCompetitionDraft } from "@/lib/tournament-draft";

type GameCompetitionEditorProps = {
  competition: GameCompetitionDraft;
  index: number;
  canRemove: boolean;
  onChange: (competition: GameCompetitionDraft) => void;
  onRemove: () => void;
};

function subscribeToGames(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(gameCatalogChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(gameCatalogChangeEvent, onStoreChange); };
}

function getGamesSnapshot() {
  return window.localStorage.getItem(gameCatalogStorageKey) ?? "";
}

export function GameCompetitionEditor({ competition, index, canRemove, onChange, onRemove }: GameCompetitionEditorProps) {
  const storedGames = useSyncExternalStore(subscribeToGames, getGamesSnapshot, () => "");
  const availableGames = useMemo(() => {
    try { return (storedGames ? JSON.parse(storedGames) as ManagedGame[] : defaultManagedGames).filter((game) => game.active || game.slug === competition.gameSlug); } catch { return defaultManagedGames; }
  }, [competition.gameSlug, storedGames]);
  function updateCompetition(changes: Partial<GameCompetitionDraft>) {
    onChange({ ...competition, ...changes });
  }

  function updateLeagueTeamCount(teamCount: number) {
    const safeTeamCount = Math.max(2, Math.min(teamCount, 32));
    const leagueTeams = Array.from(
      { length: safeTeamCount },
      (_, teamIndex) => competition.leagueTeams[teamIndex] ?? createLeagueTeam(teamIndex, competition.id),
    );
    updateCompetition({ leagueTeamCount: safeTeamCount, leagueTeams });
  }

  function updatePlayersPerTeam(playersPerTeam: number) {
    const safePlayersPerTeam = Math.max(1, Math.min(playersPerTeam, 10));
    updateCompetition({
      playersPerTeam: safePlayersPerTeam,
      leagueTeams: competition.leagueTeams.map((team) => ({ ...team, playerIds: team.playerIds.slice(0, safePlayersPerTeam) })),
    });
  }

  return (
    <article className="card panel game-competition-editor">
      <div className="section-header stage-header">
        <div><span className="status">GAME COMPETITION {index + 1}</span><h2>{competition.name}</h2></div>
        <button className="button button-secondary button-small" type="button" disabled={!canRemove} title={canRemove ? `Remove ${competition.name}` : "An event must have at least one game competition"} onClick={onRemove}><Trash2 size={15} /> Remove game</button>
      </div>

      <div className="builder-grid">
        <label className="form-group"><span className="form-label">Competition name</span><input className="input" value={competition.name} onChange={(event) => updateCompetition({ name: event.target.value })} /></label>
        <label className="form-group"><span className="form-label">Game</span><select className="select" value={competition.gameSlug} onChange={(event) => updateCompetition({ gameSlug: event.target.value as GameCompetitionDraft["gameSlug"] })}>{!availableGames.some((game) => game.slug === competition.gameSlug) && <option value={competition.gameSlug}>{competition.gameSlug}</option>}{availableGames.map((game) => <option value={game.slug} key={game.slug}>{game.name} · {game.genre}</option>)}</select></label>
        <label className="form-group"><span className="form-label">Competition type</span><select className="select" value={competition.competitionType} onChange={(event) => updateCompetition({ competitionType: event.target.value as GameCompetitionDraft["competitionType"] })}><option value="tournament">Tournament · Individual registration</option><option value="league">League · Admin-assigned teams</option></select></label>
        {competition.competitionType === "tournament"
          ? <label className="form-group"><span className="form-label">Planned participants</span><input className="input" type="number" min="2" value={competition.maxEntries} onChange={(event) => updateCompetition({ maxEntries: Number(event.target.value) })} /><span className="helper">Used for planning only. The bracket is generated from checked-in participants when the event starts.</span></label>
          : <label className="form-group"><span className="form-label">Number of teams</span><input className="input" type="number" min="2" max="32" value={competition.leagueTeamCount} onChange={(event) => updateLeagueTeamCount(Number(event.target.value))} /></label>}
      </div>

      {competition.competitionType === "league" && <div className="builder-grid" style={{ marginTop: 16 }}><label className="form-group"><span className="form-label">Players per team</span><input className="input" type="number" min="1" max="10" value={competition.playersPerTeam} onChange={(event) => updatePlayersPerTeam(Number(event.target.value))} /></label><label className="form-group"><span className="form-label">Participant approval</span><select className="select" value="confirmation" disabled><option value="confirmation">Player confirmation required</option></select></label></div>}

      {competition.competitionType === "tournament" ? (
        <section className="card panel registration-workflow">
          <h3 className="panel-title">Tournament registration</h3>
          <div className="builder-grid">
            <label className="form-group"><span className="form-label">Mobile registration</span><select className="select" value="individual" disabled><option value="individual">Open individual signup</option></select></label>
            <label className="form-group"><span className="form-label">Payment confirmation</span><select className="select" value="manual" disabled><option value="manual">Mark payment received manually</option></select></label>
          </div>
          <div className="form-group registration-limit-toggle"><label className="form-label"><input type="checkbox" checked={competition.registrationRestricted} onChange={(event) => updateCompetition({ registrationRestricted: event.target.checked })} /> Restrict registration slots</label><span className="helper">Leave this off for unlimited signup. Turn it on to show “Slots full” when the limit is reached.</span></div>
          {competition.registrationRestricted && <label className="form-group"><span className="form-label">Registration slot limit</span><input className="input" type="number" min="2" value={competition.registrationLimit} onChange={(event) => updateCompetition({ registrationLimit: Number(event.target.value) })} /></label>}
          <p className="helper">Registered users remain payment-pending until an admin marks their payment as received.</p>
        </section>
      ) : <LeagueTeamAssignments teams={competition.leagueTeams} playersPerTeam={competition.playersPerTeam} onChange={(leagueTeams) => updateCompetition({ leagueTeams })} />}

      <TournamentStagePipeline
        value={competition.stages}
        participantCount={competition.competitionType === "league" ? competition.leagueTeamCount : competition.maxEntries}
        participantLabel={competition.competitionType === "league" ? "teams" : "participants"}
        onChange={(stages) => updateCompetition({ stages })}
      />
    </article>
  );
}
