import type { BoardSide, BoardState } from "@/lib/stream-board-data";

export function flagEmoji(iso2: string | null | undefined) {
  if (!iso2 || iso2.length !== 2) return null;
  const codePoints = [...iso2.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65);
  if (codePoints.some((point) => point < 0x1f1e6 || point > 0x1f1ff)) return null;
  return String.fromCodePoint(...codePoints);
}

export function sideLabel(side: BoardSide | undefined) {
  return side?.displayName ?? "TBD";
}

export function initials(name: string | null | undefined) {
  return (name ?? "TBD")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({ url, name, className }: { url: string | null | undefined; name: string | null | undefined; className?: string }) {
  const classes = ["overlay-avatar", className].filter(Boolean).join(" ");
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- next/image optimization adds nothing inside an OBS source
    return <img className={classes} src={url} alt={name ?? "Player"} />;
  }
  return <span className={`${classes} overlay-avatar-initials`}>{initials(name)}</span>;
}

export function StatusBadge({ state }: { state: BoardState }) {
  const status = state.match?.status;
  if (status === "live") {
    return (
      <span className="overlay-status-live">
        <span className="overlay-live-dot" /> LIVE
      </span>
    );
  }
  if (status === "paused") return <span>PAUSED</span>;
  if (status === "final" || status === "forfeit") return <span className="overlay-status-final">FINAL</span>;
  return null;
}

export function isWinner(state: BoardState, side: BoardSide | undefined) {
  if (!side?.participantId || !state.match?.winnerParticipantId) return false;
  return state.match.winnerParticipantId === side.participantId;
}
