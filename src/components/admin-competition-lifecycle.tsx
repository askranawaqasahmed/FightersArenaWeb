"use client";

import { AlertTriangle, CheckCircle2, Clock3, Eye, Flag, Minus, Pencil, Play, Plus, Save, X, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminStreamBoards, type StreamBoardInfo } from "./admin-stream-boards";
import { ConnectedEliminationBracket } from "./connected-elimination-bracket";
import type { Bracket } from "@/domain/tournament-engine";
import type { AdminLifecycleCompetition } from "@/lib/admin-events";
import { formatMatchDuration } from "@/lib/match-duration";

type PreviewResponse = {
  division: { id: string; name: string; status: string; competitionType: string };
  validation: {
    valid: boolean;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
    actualParticipants: number;
    generatedSize: number | null;
  };
  stage: { id: string; name: string; format: string; status: string } | null;
  bracket: Bracket | null;
  matches: Array<{
    id: string;
    code: string;
    matchNumber: number;
    status: string;
    bestOf: number;
    round: string;
    roundSequence: number;
    lane: string;
    startedAt: string | null;
    endedAt: string | null;
    sides: Array<{ participantId: string | null; name: string | null; score: number; outcome: string | null }>;
  }>;
};

type PreviewMatch = PreviewResponse["matches"][number];

function MatchDuration({ startedAt, endedAt }: { startedAt: string | null; endedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, endedAt]);

  const duration = formatMatchDuration(startedAt, endedAt, now);
  if (!duration) return null;
  return <div className="match-duration"><Clock3 size={12} aria-hidden="true" /> {endedAt ? `Finished in ${duration}` : `Live for ${duration}`}</div>;
}

const completedMatchStatuses = new Set(["final", "forfeit", "cancelled"]);

function matchStatusPriority(status: string) {
  if (status === "live") return 0;
  if (status === "ready") return 1;
  if (status === "scheduled") return 2;
  if (completedMatchStatuses.has(status)) return 4;
  return 3;
}

function orderMatchesByStatus(matches: PreviewMatch[]) {
  return matches
    .map((match, bracketOrder) => ({ match, bracketOrder }))
    .sort((left, right) => matchStatusPriority(left.match.status) - matchStatusPriority(right.match.status)
      || left.match.matchNumber - right.match.matchNumber
      || left.bracketOrder - right.bracketOrder)
    .map(({ match }) => match);
}

export function AdminCompetitionLifecycle({ competition, onStatusChange }: { competition: AdminLifecycleCompetition; onStatusChange?: (status: AdminLifecycleCompetition["status"], actualParticipants?: number) => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState<"preview" | "entrants" | "start" | "complete" | null>(null);
  const [matchLoading, setMatchLoading] = useState<string | null>(null);
  const [matchAction, setMatchAction] = useState<"start" | "finish" | "edit" | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, [string, string]>>({});
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");
  const [actualParticipantOverride, setActualParticipantOverride] = useState<number>();
  const [statusOverride, setStatusOverride] = useState<AdminLifecycleCompetition["status"]>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [boards, setBoards] = useState<StreamBoardInfo[] | null>(null);
  const endpoint = `/api/v1/admin/tournaments/${competition.tournamentId}/divisions/${competition.divisionId}/lifecycle`;
  const testEntrantsEndpoint = `/api/v1/admin/tournaments/${competition.tournamentId}/divisions/${competition.divisionId}/test-entrants`;
  const currentStatus = statusOverride ?? competition.status;
  const canStart = !["LIVE", "COMPLETED"].includes(currentStatus);
  const canComplete = currentStatus === "LIVE" && competition.totalMatches > 0 && competition.unfinishedMatches === 0;
  const actualParticipants = actualParticipantOverride ?? competition.actualParticipants;
  const controlsBusy = loading !== null || matchLoading !== null;
  const nextStartableMatch = preview
    ? orderMatchesByStatus(preview.matches).find((match) =>
      ["scheduled", "ready", "paused"].includes(match.status)
      && match.sides.filter((side) => side.participantId).length === 2)
    : undefined;

  async function fetchPreview() {
    const response = await fetch(endpoint, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail ?? "Unable to load this game tournament preview.");
    const data = body.data as PreviewResponse;
    setPreview(data);
    void fetchBoards();
    return data;
  }

  async function fetchBoards() {
    try {
      const response = await fetch("/api/v1/admin/boards", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to load stream boards.");
      setBoards(body.data.boards as StreamBoardInfo[]);
    } catch {
      setBoards([]);
    }
  }

  async function updateBoard(boardNumber: number, patch: { matchId: string | null; featuredSlot?: 1 | 2 | null }) {
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/boards/${boardNumber}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to update board ${boardNumber}.`);
      await fetchBoards();
    } catch (boardError) {
      setError(true);
      setMessage(boardError instanceof Error ? boardError.message : `Unable to update board ${boardNumber}.`);
    }
  }

  async function adjustScore(match: PreviewMatch, slot: 1 | 2, delta: 1 | -1) {
    setError(false);
    try {
      const response = await fetch(`/api/v1/admin/matches/${match.id}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "score_adjust", slot, delta }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to adjust the score for ${match.code}.`);
      const scores = body.data.scores as [number, number];
      setMatchScores((current) => ({ ...current, [match.id]: [String(scores[0]), String(scores[1])] }));
      setPreview((current) => current
        ? {
          ...current,
          matches: current.matches.map((item) => item.id === match.id
            ? { ...item, sides: item.sides.map((side, index) => ({ ...side, score: scores[index] ?? side.score })) }
            : item),
        }
        : current);
    } catch (scoreError) {
      setError(true);
      setMessage(scoreError instanceof Error ? scoreError.message : `Unable to adjust the score for ${match.code}.`);
    }
  }

  async function togglePreview() {
    if (previewOpen) {
      setPreviewOpen(false);
      return;
    }
    setLoading("preview");
    setError(false);
    setMessage("");
    try {
      await fetchPreview();
      setPreviewOpen(true);
    } catch (previewError) {
      setError(true);
      setMessage(previewError instanceof Error ? previewError.message : "Unable to load preview.");
    } finally {
      setLoading(null);
    }
  }

  async function runAction(action: "start" | "complete") {
    setLoading(action);
    setError(false);
    setMessage("");
    try {
      if (action === "start") {
        const report = await fetchPreview();
        setPreviewOpen(true);
        if (!report.validation.valid) {
          setError(true);
          setMessage("Start blocked. Resolve every validation error shown below.");
          return;
        }
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to ${action} this game tournament.`);
      setMessage(action === "start"
        ? "Game tournament started. Its bracket and matches are now saved in the database."
        : "Game tournament completed. Placements and historical participant snapshots were saved.");
      const nextStatus = action === "start" ? "LIVE" as const : "COMPLETED" as const;
      setStatusOverride(nextStatus);
      onStatusChange?.(nextStatus, actualParticipants);
      if (action === "start") {
        try {
          await fetchPreview();
          setPreviewOpen(true);
        } catch {
          setPreview(null);
          setPreviewOpen(false);
        }
      } else {
        setPreview(null);
        setPreviewOpen(false);
      }
      router.refresh();
    } catch (actionError) {
      setError(true);
      setMessage(actionError instanceof Error ? actionError.message : `Unable to ${action} this game tournament.`);
    } finally {
      setLoading(null);
    }
  }

  async function startMatch(match: PreviewMatch) {
    setMatchLoading(match.id);
    setMatchAction("start");
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/matches/${match.id}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to start ${match.code}.`);
      setMessage(`${match.code} started. The match is now live.`);
      try {
        await fetchPreview();
        setPreviewOpen(true);
      } catch {
        setPreview(null);
        setPreviewOpen(false);
      }
      router.refresh();
    } catch (matchError) {
      setError(true);
      setMessage(matchError instanceof Error ? matchError.message : `Unable to start ${match.code}.`);
    } finally {
      setMatchLoading(null);
      setMatchAction(null);
    }
  }

  function updateMatchScore(match: PreviewMatch, sideIndex: 0 | 1, value: string) {
    const current = matchScores[match.id] ?? [String(match.sides[0]?.score ?? 0), String(match.sides[1]?.score ?? 0)];
    const next: [string, string] = [...current];
    next[sideIndex] = value;
    setMatchScores((scores) => ({ ...scores, [match.id]: next }));
  }

  async function finishLiveMatch(match: PreviewMatch) {
    const enteredScores = matchScores[match.id] ?? [String(match.sides[0]?.score ?? 0), String(match.sides[1]?.score ?? 0)];
    const scores = enteredScores.map(Number) as [number, number];
    if (scores.some((score) => !Number.isInteger(score) || score < 0)) {
      setError(true);
      setMessage("Enter a non-negative whole-number score for both players.");
      return;
    }
    const isDraw = scores[0] === scores[1];
    if (isDraw && preview?.stage?.format !== "round_robin") {
      setError(true);
      setMessage("Elimination matches cannot end in a draw. Enter a winning score for one player.");
      return;
    }
    const winnerSide = isDraw ? null : match.sides[scores[0] > scores[1] ? 0 : 1];
    if (!isDraw && !winnerSide?.participantId) {
      setError(true);
      setMessage("The winning player is not resolved for this match yet.");
      return;
    }

    setMatchLoading(match.id);
    setMatchAction("finish");
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/matches/${match.id}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "finish",
          winnerParticipantId: winnerSide?.participantId ?? null,
          scores,
          startNext: false,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to end ${match.code}.`);
      const resultMessage = isDraw
        ? `${match.code} ended ${scores[0]}–${scores[1]}. The standings were updated.`
        : `${match.code} ended ${scores[0]}–${scores[1]}. ${winnerSide?.name ?? "The winner"} advanced and both players were routed through their configured bracket paths.`;
      setMessage(resultMessage);
      setMatchScores((current) => {
        const next = { ...current };
        delete next[match.id];
        return next;
      });
      try {
        await fetchPreview();
        setPreviewOpen(true);
      } catch {
        setPreview(null);
        setPreviewOpen(false);
      }
      router.refresh();
    } catch (matchError) {
      setError(true);
      setMessage(matchError instanceof Error ? matchError.message : `Unable to end ${match.code}.`);
    } finally {
      setMatchLoading(null);
      setMatchAction(null);
    }
  }

  function beginResultEdit(match: PreviewMatch) {
    setEditingResultId(match.id);
    setMatchScores((scores) => ({ ...scores, [match.id]: [String(match.sides[0]?.score ?? 0), String(match.sides[1]?.score ?? 0)] }));
    setEditReason("");
    setError(false);
    setMessage("");
  }

  function cancelResultEdit(matchId: string) {
    setEditingResultId(null);
    setEditReason("");
    setMatchScores((current) => {
      const next = { ...current };
      delete next[matchId];
      return next;
    });
  }

  async function saveEditedResult(match: PreviewMatch) {
    const enteredScores = matchScores[match.id] ?? [String(match.sides[0]?.score ?? 0), String(match.sides[1]?.score ?? 0)];
    const scores = enteredScores.map(Number) as [number, number];
    if (scores.some((score) => !Number.isInteger(score) || score < 0)) {
      setError(true);
      setMessage("Enter a non-negative whole-number score for both players.");
      return;
    }
    if (editReason.trim().length < 3) {
      setError(true);
      setMessage("Enter a short reason for correcting this result.");
      return;
    }
    const isDraw = scores[0] === scores[1];
    if (isDraw && preview?.stage?.format !== "round_robin") {
      setError(true);
      setMessage("Elimination matches cannot end in a draw. Enter a winning score for one player.");
      return;
    }
    const winnerSide = isDraw ? null : match.sides[scores[0] > scores[1] ? 0 : 1];
    if (!isDraw && !winnerSide?.participantId) {
      setError(true);
      setMessage("The winning player is not resolved for this match yet.");
      return;
    }

    setMatchLoading(match.id);
    setMatchAction("edit");
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/matches/${match.id}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit_result",
          winnerParticipantId: winnerSide?.participantId ?? null,
          scores,
          reason: editReason.trim(),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to edit ${match.code}.`);
      setMessage(`${match.code} was corrected to ${scores[0]}–${scores[1]}. Standings and unlocked bracket paths were updated.`);
      setEditingResultId(null);
      setEditReason("");
      setMatchScores((current) => {
        const next = { ...current };
        delete next[match.id];
        return next;
      });
      try {
        await fetchPreview();
        setPreviewOpen(true);
      } catch {
        setPreview(null);
        setPreviewOpen(false);
      }
      router.refresh();
    } catch (matchError) {
      setError(true);
      setMessage(matchError instanceof Error ? matchError.message : `Unable to edit ${match.code}.`);
    } finally {
      setMatchLoading(null);
      setMatchAction(null);
    }
  }

  async function addDummyPlayers() {
    setLoading("entrants");
    setError(false);
    setMessage("");
    try {
      const response = await fetch(testEntrantsEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: 8 }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to add dummy players.");
      setActualParticipantOverride(body.data.actualParticipants);
      setStatusOverride("READY");
      onStatusChange?.("READY", body.data.actualParticipants);
      setMessage(`${body.data.actualParticipants} eligible, checked-in dummy players were added. The tournament is ready to validate and start.`);
      try {
        await fetchPreview();
        setPreviewOpen(true);
      } catch {
        setPreview(null);
        setPreviewOpen(false);
      }
      router.refresh();
    } catch (signupError) {
      setError(true);
      setMessage(signupError instanceof Error ? signupError.message : "Unable to add dummy players.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="competition-lifecycle">
      <div className="competition-lifecycle-summary">
        <div><span className="status">DATABASE LIFECYCLE</span><p className="helper">{actualParticipants} eligible and checked in · {competition.totalMatches} saved matches · {competition.unfinishedMatches} unfinished</p></div>
        <div className="header-actions">
          <button className="button button-secondary button-small" type="button" disabled={controlsBusy} onClick={togglePreview}><Eye size={15} /> {loading === "preview" ? "Loading…" : previewOpen ? "Close matches" : currentStatus === "LIVE" ? "Manage matches" : "Preview bracket & matches"}</button>
          {canStart && actualParticipants < 2 && <button className="button button-secondary button-small" type="button" disabled={controlsBusy} onClick={addDummyPlayers}><Play size={15} /> {loading === "entrants" ? "Adding…" : "Add dummy players"}</button>}
          {canStart && <button className="button button-primary button-small" type="button" disabled={controlsBusy} onClick={() => runAction("start")}><Play size={15} /> {loading === "start" ? "Validating…" : "Start tournament"}</button>}
          {currentStatus === "LIVE" && <button className="button button-primary button-small" type="button" disabled={controlsBusy || !canComplete} title={canComplete ? "Complete and save this game tournament" : `${competition.unfinishedMatches || competition.totalMatches} matches must be completed first`} onClick={() => runAction("complete")}><Flag size={15} /> {loading === "complete" ? "Saving…" : "End tournament"}</button>}
        </div>
      </div>
      {currentStatus === "LIVE" && !canComplete && <p className="helper completion-blocked"><AlertTriangle size={14} /> End tournament unlocks after all matches are final, forfeited, or cancelled.</p>}
      {message && <p className={`form-message ${error ? "form-error" : "form-success"}`} role="status">{message}</p>}
      {previewOpen && preview && <section className="competition-specific-preview" aria-label={`${competition.name} preview`}>
        <div className="section-header"><div><span className="status">{competition.game}</span><h3>{competition.name} only</h3><p className="helper">This preview excludes every other game tournament in the event.</p></div><div className="preview-primary-actions"><span className={`status ${canStart && !preview.validation.valid ? "danger" : currentStatus === "LIVE" ? "live" : ""}`}>{canStart ? preview.validation.valid ? "START VALID" : "START BLOCKED" : currentStatus}</span>{currentStatus === "LIVE" && nextStartableMatch && <button className="button button-primary" type="button" disabled={controlsBusy} aria-label={`${nextStartableMatch.status === "paused" ? "Resume" : "Start"} ${nextStartableMatch.code} from top controls`} onClick={() => startMatch(nextStartableMatch)}><Play size={15} /> {matchLoading === nextStartableMatch.id && matchAction === "start" ? "Starting…" : nextStartableMatch.status === "paused" ? "Resume match" : "Start match"}<span className="top-match-code">{nextStartableMatch.code}</span></button>}</div></div>
        {canStart && <div className="start-validation-list">
          {preview.validation.valid && <div className="validation-item valid"><CheckCircle2 size={15} /><span>{preview.validation.actualParticipants} actual participants validated{preview.validation.generatedSize ? ` · ${preview.validation.generatedSize} generated slots` : ""}</span></div>}
          {preview.validation.errors.map((issue) => <div className="validation-item invalid" key={issue.code}><XCircle size={15} /><span>{issue.message}</span></div>)}
          {preview.validation.warnings.map((issue) => <div className="validation-item warning" key={issue.code}><AlertTriangle size={15} /><span>{issue.message}</span></div>)}
          {!preview.validation.valid && actualParticipants < 2 && <div className="validation-item warning"><Play size={15} /><span>No real eligible players yet. Add up to eight temporary checked-in players for this rehearsal.</span><button className="button button-secondary button-small validation-item-action" type="button" disabled={controlsBusy} onClick={addDummyPlayers}>{loading === "entrants" ? "Adding…" : "Add dummy players"}</button></div>}
        </div>}
        {currentStatus === "LIVE" && <AdminStreamBoards boards={boards} matches={preview.matches} busy={controlsBusy} onUpdate={updateBoard} />}
        {preview.bracket && <ConnectedEliminationBracket bracket={preview.bracket} matches={preview.matches} />}
        <div className="table-scroll competition-preview-matches"><table className="data-table"><thead><tr><th>Match</th><th>Round</th><th>Participants</th><th>Series</th><th>Status</th>{currentStatus === "LIVE" && <th>Action</th>}</tr></thead><tbody>{orderMatchesByStatus(preview.matches).map((match) => {
          const hasBothParticipants = match.sides.filter((side) => side.participantId).length === 2;
          const canStartMatch = ["scheduled", "ready", "paused"].includes(match.status) && hasBothParticipants;
          const enteredScores = matchScores[match.id] ?? [String(match.sides[0]?.score ?? 0), String(match.sides[1]?.score ?? 0)];
          const participants = completedMatchStatuses.has(match.status)
            ? match.sides.map((side) => `${side.name ?? "TBD"} ${side.score}`).join(" vs ")
            : match.sides.map((side) => side.name ?? "TBD").join(" vs ");
          const scoreInputs = <div className="match-score-entry">{match.sides.map((side, sideIndex) => <label key={`${match.id}-${sideIndex}`}><span>{side.name ?? `Player ${sideIndex + 1}`}</span><input className="input" type="number" min="0" step="1" inputMode="numeric" aria-label={`${side.name ?? `Player ${sideIndex + 1}`} score for ${match.code}`} value={enteredScores[sideIndex]} disabled={controlsBusy} onChange={(event) => updateMatchScore(match, sideIndex as 0 | 1, event.target.value)} /></label>)}</div>;
          const liveScoreControls = <div className="match-score-entry">{match.sides.map((side, sideIndex) => <label className="live-score-row" key={`${match.id}-${sideIndex}`}><span>{side.name ?? `Player ${sideIndex + 1}`}</span><span className="live-score-buttons"><button className="button button-secondary button-small" type="button" disabled={controlsBusy} aria-label={`Decrease ${side.name ?? `player ${sideIndex + 1}`} score for ${match.code}`} onClick={() => adjustScore(match, (sideIndex + 1) as 1 | 2, -1)}><Minus size={13} /></button><input className="input" type="number" min="0" step="1" inputMode="numeric" aria-label={`${side.name ?? `Player ${sideIndex + 1}`} score for ${match.code}`} value={enteredScores[sideIndex]} disabled={controlsBusy} onChange={(event) => updateMatchScore(match, sideIndex as 0 | 1, event.target.value)} /><button className="button button-secondary button-small" type="button" disabled={controlsBusy} aria-label={`Increase ${side.name ?? `player ${sideIndex + 1}`} score for ${match.code}`} onClick={() => adjustScore(match, (sideIndex + 1) as 1 | 2, 1)}><Plus size={13} /></button></span></label>)}</div>;
          const actionControl = canStartMatch
            ? <button className="button button-primary button-small" type="button" disabled={controlsBusy} onClick={() => startMatch(match)}><Play size={14} /> {matchLoading === match.id && matchAction === "start" ? "Starting…" : match.status === "paused" ? "Resume match" : "Start match"}</button>
            : match.status === "live"
              ? <div className="match-result-controls" aria-label={`Finish ${match.code}`}>{liveScoreControls}<button className="button button-primary button-small" type="button" disabled={controlsBusy} onClick={() => finishLiveMatch(match)}><Flag size={14} /> {matchLoading === match.id && matchAction === "finish" ? "Ending…" : "End match"}</button></div>
              : match.status === "final"
                ? editingResultId === match.id
                  ? <div className="match-result-controls match-result-editor" aria-label={`Edit result for ${match.code}`}>{scoreInputs}<label className="match-edit-reason"><span>Correction reason</span><input className="input" type="text" maxLength={500} value={editReason} disabled={controlsBusy} aria-label={`Reason for correcting ${match.code}`} placeholder="Why is this score changing?" onChange={(event) => setEditReason(event.target.value)} /></label><div className="header-actions"><button className="button button-primary button-small" type="button" disabled={controlsBusy} aria-label={`Save score changes for ${match.code}`} onClick={() => saveEditedResult(match)}><Save size={14} /> {matchLoading === match.id && matchAction === "edit" ? "Saving…" : "Save changes"}</button><button className="button button-secondary button-small" type="button" disabled={controlsBusy} aria-label={`Cancel score changes for ${match.code}`} onClick={() => cancelResultEdit(match.id)}><X size={14} /> Cancel</button></div></div>
                  : <button className="button button-secondary button-small" type="button" disabled={controlsBusy} aria-label={`Edit score for ${match.code}`} onClick={() => beginResultEdit(match)}><Pencil size={14} /> Edit score</button>
                : <span className="muted">{completedMatchStatuses.has(match.status) ? "Finished" : "Awaiting participants"}</span>;
          return <tr key={match.id}><td><strong>Match #{match.matchNumber}</strong><div className="muted match-code-label">{match.code}</div></td><td>{match.round}<div className="muted">{match.lane}</div></td><td>{participants}</td><td>BO{match.bestOf}</td><td><span className={`status ${match.status === "live" ? "live" : ""}`}>{match.status.toUpperCase()}</span><MatchDuration startedAt={match.startedAt} endedAt={match.endedAt} /></td>{currentStatus === "LIVE" && <td>{actionControl}</td>}</tr>;
        })}</tbody></table></div>
      </section>}
    </div>
  );
}
