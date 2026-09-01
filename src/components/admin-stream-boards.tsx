"use client";

import { Check, Copy, MonitorPlay } from "lucide-react";
import { useState } from "react";

export type StreamBoardInfo = {
  number: number;
  matchId: string | null;
  featuredSlot: number | null;
  matchCode: string | null;
  matchStatus: string | null;
  tournamentName: string | null;
};

export type AssignableMatch = {
  id: string;
  code: string;
  status: string;
  sides: Array<{ name: string | null }>;
};

export const STREAM_BOARD_NUMBERS = [1, 2, 3] as const;

const overlayViews = [
  { key: "bar", label: "Bar", path: "" },
  { key: "card", label: "Card", path: "/card" },
  { key: "profile", label: "Profile", path: "/profile" },
] as const;

export function AdminStreamBoards({
  boards,
  matches,
  busy,
  onUpdate,
}: {
  boards: StreamBoardInfo[] | null;
  matches: AssignableMatch[];
  busy: boolean;
  onUpdate: (number: number, patch: { matchId: string | null; featuredSlot?: 1 | 2 | null }) => Promise<void>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const assignable = matches.filter((match) => ["ready", "live", "paused"].includes(match.status));

  async function copyUrl(boardNumber: number, path: string, key: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/overlay/board/${boardNumber}${path}`);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="stream-boards" aria-label="OBS stream boards">
      <div className="stream-boards-header">
        <MonitorPlay size={15} />
        <strong>Stream boards</strong>
        <span className="helper">Assign a match to each OBS browser source. The overlay URLs never change.</span>
      </div>
      <div className="stream-boards-grid">
        {STREAM_BOARD_NUMBERS.map((number) => {
          const board = boards?.find((item) => item.number === number) ?? null;
          const assignedMatch = board?.matchId ? matches.find((match) => match.id === board.matchId) : undefined;
          const orphanAssignment = Boolean(board?.matchId && !assignedMatch);
          return (
            <div className="stream-board" key={number}>
              <div className="stream-board-title">
                <strong>Board {number}</strong>
                {board?.matchStatus && <span className={`status ${board.matchStatus === "live" ? "live" : ""}`}>{board.matchStatus.toUpperCase()}</span>}
              </div>
              <label className="stream-board-field">
                <span>Match</span>
                <select
                  className="input"
                  value={board?.matchId ?? ""}
                  disabled={busy}
                  aria-label={`Match shown on board ${number}`}
                  onChange={(event) => onUpdate(number, { matchId: event.target.value || null, featuredSlot: (board?.featuredSlot ?? null) as 1 | 2 | null })}
                >
                  <option value="">Unassigned</option>
                  {orphanAssignment && board?.matchId && (
                    <option value={board.matchId}>
                      {board.matchCode ?? "Match"} ({board.tournamentName ?? "other tournament"})
                    </option>
                  )}
                  {assignable.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.code} — {match.sides.map((side) => side.name ?? "TBD").join(" vs ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stream-board-field">
                <span>Featured player</span>
                <select
                  className="input"
                  value={board?.featuredSlot ?? ""}
                  disabled={busy || !board?.matchId}
                  aria-label={`Featured player for board ${number} profile screen`}
                  onChange={(event) => onUpdate(number, {
                    matchId: board?.matchId ?? null,
                    featuredSlot: event.target.value ? (Number(event.target.value) as 1 | 2) : null,
                  })}
                >
                  <option value="">—</option>
                  <option value="1">{assignedMatch?.sides[0]?.name ?? "Player 1"}</option>
                  <option value="2">{assignedMatch?.sides[1]?.name ?? "Player 2"}</option>
                </select>
              </label>
              <div className="stream-board-links">
                {overlayViews.map((view) => {
                  const key = `${number}-${view.key}`;
                  return (
                    <button
                      key={key}
                      className="button button-secondary button-small"
                      type="button"
                      title={`Copy the ${view.label.toLowerCase()} overlay URL for board ${number}`}
                      onClick={() => copyUrl(number, view.path, key)}
                    >
                      {copied === key ? <Check size={13} /> : <Copy size={13} />} {view.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
