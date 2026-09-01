"use client";

import { CheckCircle2, Plus, Trash2, WandSparkles } from "lucide-react";
import { useRef, useState } from "react";
import { createStage, generatedBracketSize, stageParticipantCount, type StageFormat, type TournamentStageDraft } from "@/lib/tournament-draft";

const stageTitles: Record<StageFormat, string> = {
  groups: "Round-robin groups",
  "single-elimination": "Single-elimination playoffs",
  "double-elimination": "Double-elimination playoffs",
};

type TournamentStagePipelineProps = {
  value?: TournamentStageDraft[];
  participantCount?: number;
  participantLabel?: "participants" | "teams";
  onChange?: (stages: TournamentStageDraft[]) => void;
};

export function TournamentStagePipeline({ value, participantCount = 8, participantLabel = "participants", onChange }: TournamentStagePipelineProps = {}) {
  const [internalStages, setInternalStages] = useState<TournamentStageDraft[]>([createStage("stage-1")]);
  const nextStageId = useRef(2);
  const stages = value ?? internalStages;
  const canRemoveStage = stages.length > 1;

  function setStages(update: (currentStages: TournamentStageDraft[]) => TournamentStageDraft[]) {
    const updatedStages = update(stages);
    if (onChange) onChange(updatedStages);
    else setInternalStages(updatedStages);
  }

  function addStage() {
    setStages((currentStages) => [
      ...currentStages,
      createStage(`stage-${nextStageId.current++}`),
    ]);
  }

  function updateStageFormat(id: string, format: StageFormat) {
    setStages((currentStages) => currentStages.map((stage) =>
      stage.id === id ? { ...stage, format } : stage
    ));
  }

  function updateStage(id: string, changes: Partial<TournamentStageDraft>) {
    setStages((currentStages) => currentStages.map((stage) =>
      stage.id === id ? { ...stage, ...changes } : stage
    ));
  }

  function removeStage(id: string) {
    setStages((currentStages) => currentStages.length > 1
      ? currentStages.filter((stage) => stage.id !== id)
      : currentStages);
  }

  return (
    <>
      <h2 className="panel-title" style={{ marginTop: 34 }}>Stage pipeline</h2>
      <div className="activity">
        {stages.map((stage, index) => {
          const eliminationParticipants = stageParticipantCount(stages, index, participantCount);
          const bracketSize = generatedBracketSize(eliminationParticipants);
          const byeCount = bracketSize - eliminationParticipants;
          return (
            <div className="card panel" key={stage.id}>
              <div className="section-header stage-header">
                <div>
                  <span className="status">STAGE {index + 1}</span>
                  <h3>{stageTitles[stage.format]}</h3>
                </div>
                <div className="header-actions">
                  {stage.format === "groups" ? <CheckCircle2 className="green" /> : <WandSparkles className="blue" />}
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    aria-label={`Remove stage ${index + 1}`}
                    title={canRemoveStage ? `Remove stage ${index + 1}` : "A tournament must have at least one stage"}
                    disabled={!canRemoveStage}
                    onClick={() => removeStage(stage.id)}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>

              <label className="form-group" style={{ marginBottom: 16 }}>
                <span className="form-label">Stage format</span>
                <select
                  className="select"
                  value={stage.format}
                  aria-label={`Format for stage ${index + 1}`}
                  onChange={(event) => updateStageFormat(stage.id, event.target.value as StageFormat)}
                >
                  <option value="groups">Round-robin groups</option>
                  <option value="single-elimination">Single-elimination playoffs</option>
                  <option value="double-elimination">Double-elimination playoffs</option>
                </select>
              </label>

              {stage.format === "groups" ? (
                <div className="builder-grid">
                  <label className="form-group"><span className="form-label">Groups</span><input className="input" type="number" min="1" value={stage.groups} onChange={(event) => updateStage(stage.id, { groups: Number(event.target.value) })} /></label>
                  <label className="form-group"><span className="form-label">Advance per group</span><input className="input" type="number" min="1" value={stage.advancePerGroup} onChange={(event) => updateStage(stage.id, { advancePerGroup: Number(event.target.value) })} /></label>
                </div>
              ) : (
                <div className="builder-grid">
                  <div className="form-group"><span className="form-label">Generated bracket</span><div className="input bracket-size-summary">{eliminationParticipants} {participantLabel} → {bracketSize} slots</div><span className="helper">Calculated automatically from this stage&apos;s entrants{byeCount > 0 ? ` with ${byeCount} ${byeCount === 1 ? "bye" : "byes"}` : ""}.</span></div>
                  {stage.format === "double-elimination" ? (
                    <label className="form-group"><span className="form-label">Grand final</span><select className="select" value={stage.grandFinalReset ? "reset" : "single"} onChange={(event) => updateStage(stage.id, { grandFinalReset: event.target.value === "reset" })}><option value="reset">Reset if lower wins</option><option value="single">Single series</option></select></label>
                  ) : (
                    <label className="form-group"><span className="form-label">Series length</span><select className="select" value={stage.bestOf} onChange={(event) => updateStage(stage.id, { bestOf: Number(event.target.value) as TournamentStageDraft["bestOf"] })}><option value="3">Best of 3</option><option value="5">Best of 5</option><option value="7">Best of 7</option></select></label>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button className="button button-secondary" type="button" onClick={addStage}><Plus size={15} /> Add stage</button>
      </div>
    </>
  );
}
