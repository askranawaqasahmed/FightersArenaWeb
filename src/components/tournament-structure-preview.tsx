"use client";

import { FileText, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { generateDoubleElimination, generateSingleElimination } from "@/domain/tournament-engine";
import { ConnectedEliminationBracket } from "./connected-elimination-bracket";
import { stageParticipantCount, type GameCompetitionDraft, type TournamentDraft, type TournamentStageDraft } from "@/lib/tournament-draft";

const dummyPlayerNames = [
  "Ayaan Nova Khan",
  "Zain Viper Malik",
  "Haris Raven Ali",
  "Omar Frost Siddiqui",
  "Saad Blaze Ahmed",
  "Hamza Phantom Raza",
  "Bilal Titan Sheikh",
  "Daniyal Storm Qureshi",
  "Taha Reaper Mirza",
  "Usman Pulse Baig",
  "Fahad Shadow Iqbal",
  "Rayan Ace Hashmi",
  "Sameer Flux Abbasi",
  "Ali Venom Javed",
  "Ibrahim Onyx Farooq",
  "Ahmed Drift Nadeem",
];

function generatedPreviewNames(count: number, generation: number) {
  return Array.from({ length: count }, (_, index) => {
    const playerIndex = (index + generation * 5) % dummyPlayerNames.length;
    const cycle = Math.floor((index + generation * 5) / dummyPlayerNames.length);
    return `${dummyPlayerNames[playerIndex]}${cycle > 0 ? ` ${cycle + 1}` : ""}`;
  });
}

function EliminationPreview({ stage, participantCount }: { stage: TournamentStageDraft; participantCount: number }) {
  const [previewNames, setPreviewNames] = useState<string[]>();
  const [generation, setGeneration] = useState(0);
  if (participantCount < 2) return <p className="form-message form-error">At least two entrants must reach an elimination stage.</p>;
  const activeNames = Array.from({ length: participantCount }, (_, index) => previewNames?.[index] ?? `Seed ${index + 1}`);
  const participants = activeNames.map((name, index) => ({ id: `seed-${index + 1}`, name, seed: index + 1 }));
  const bracket = stage.format === "double-elimination"
    ? generateDoubleElimination(participants, { bestOf: stage.bestOf, grandFinalReset: stage.grandFinalReset })
    : generateSingleElimination(participants, { bestOf: stage.bestOf });

  function generateNames() {
    setPreviewNames(generatedPreviewNames(participantCount, generation));
    setGeneration((current) => current + 1);
  }

  function updateName(index: number, name: string) {
    setPreviewNames(activeNames.map((currentName, currentIndex) => currentIndex === index ? name : currentName));
  }

  return (
    <div aria-label={`${stage.format === "double-elimination" ? "Double" : "Single"} elimination bracket preview`}>
      <section className="preview-seeding-panel" aria-label="Preview seeding">
        <div className="preview-seeding-header">
          <div><span className="status"><Users size={13} aria-hidden="true" /> Preview seeding</span><p>Generate temporary players for this preview. In the live tournament, seeds will be populated from confirmed signups.</p></div>
          <button className="button button-secondary button-small" type="button" onClick={generateNames}><RefreshCw size={14} /> {previewNames ? "Regenerate players" : "Generate dummy players"}</button>
        </div>
        {previewNames && <div className="preview-seed-grid">{activeNames.map((name, index) => <label className="preview-seed-row" key={index}><span>#{index + 1}</span><input className="input" aria-label={`Preview name for seed ${index + 1}`} value={name} onChange={(event) => updateName(index, event.target.value)} /></label>)}</div>}
      </section>
      <ConnectedEliminationBracket bracket={bracket} />
    </div>
  );
}

function GroupPreview({ stage, maxEntries }: { stage: TournamentStageDraft; maxEntries: number }) {
  const groupCount = Math.max(1, Math.min(stage.groups, 16));
  const entriesPerGroup = Math.ceil(maxEntries / groupCount);
  return <div className="group-preview-grid">{Array.from({ length: groupCount }, (_, index) => <article className="card group-preview-card" key={index}><strong>Group {String.fromCharCode(65 + index)}</strong><span>{entriesPerGroup} entries</span><span>Top {stage.advancePerGroup} advance</span></article>)}</div>;
}

function CompetitionPreview({ competition, index }: { competition: GameCompetitionDraft; index: number }) {
  const competitionEntries = competition.competitionType === "league" ? competition.leagueTeamCount : competition.maxEntries;
  const gameName = competition.gameSlug === "dota-2" ? "Dota 2" : competition.gameSlug === "valorant" ? "VALORANT" : "Tekken 8";
  return (
    <section className="preview-event-competition">
      <div className="section-header stage-header"><div><span className="status">GAME {index + 1} · {competition.competitionType.toUpperCase()}</span><h2>{competition.name}</h2><p className="muted">{gameName} · {competition.competitionType === "league" ? `${competition.leagueTeamCount} teams · ${competition.playersPerTeam} players per team` : `${competition.maxEntries} planned participants · ${competition.registrationRestricted ? `${competition.registrationLimit} registration slots` : "unrestricted registration"}`} · {competition.stages.length} {competition.stages.length === 1 ? "stage" : "stages"}</p></div></div>
      {competition.competitionType === "league" && <div className="group-preview-grid league-preview-grid">{competition.leagueTeams.map((team) => <article className="card group-preview-card" key={team.id}><strong>{team.name}</strong><span>{team.leaderId ? `Leader: ${team.leaderId.toUpperCase()}` : "Leader not assigned"}</span><span>{team.playerIds.length}/{competition.playersPerTeam} players assigned</span><span className="status">PENDING CONFIRMATION</span></article>)}</div>}
      <div className="activity preview-stages">{competition.stages.map((stage, stageIndex) => { const participantCount = stageParticipantCount(competition.stages, stageIndex, competitionEntries); return <section className="preview-stage" key={stage.id}><div className="section-header stage-header"><div><span className="status">STAGE {stageIndex + 1}</span><h3>{stage.format === "groups" ? "Round-robin groups" : stage.format === "single-elimination" ? "Single-elimination playoffs" : "Double-elimination playoffs"}</h3></div></div>{stage.format === "groups" ? <GroupPreview stage={stage} maxEntries={participantCount} /> : <EliminationPreview stage={stage} participantCount={participantCount} />}</section>;})}</div>
    </section>
  );
}

export function TournamentStructurePreview({ draft }: { draft: TournamentDraft }) {
  return (
    <section className="card panel builder-preview" aria-live="polite" aria-label="Event structure preview">
      <div className="eyebrow">Event draft preview</div>
      <h2 className="section-title">{draft.name || "Untitled event"}</h2>
      <p className="muted">{draft.competitions.length} game {draft.competitions.length === 1 ? "competition" : "competitions"} under one event.</p>
      {draft.imageUrl && <div className="event-image-preview" role="img" aria-label={draft.imageAlt || "Event cover preview"} style={{ backgroundImage: `linear-gradient(90deg, rgba(7,20,14,.72), rgba(7,20,14,.08)), url("${draft.imageUrl}")` }}><strong>{draft.name}</strong></div>}
      {draft.attachments.length > 0 && <div className="content-attachments">{draft.attachments.map((attachment) => <a className="attachment-row" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}><FileText size={15} /><span>{attachment.name}</span><span className="muted">{Math.ceil(attachment.sizeBytes / 1024)} KB</span></a>)}</div>}
      <div className="activity preview-stages">{draft.competitions.map((competition, index) => <CompetitionPreview competition={competition} index={index} key={competition.id} />)}</div>
    </section>
  );
}
