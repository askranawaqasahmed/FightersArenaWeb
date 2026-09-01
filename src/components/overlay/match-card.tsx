import type { BoardSide, BoardState } from "@/lib/stream-board-data";
import { Avatar, StatusBadge, flagEmoji, isWinner, sideLabel } from "@/components/overlay/overlay-bits";

function CardPlayer({ state, side }: { state: BoardState; side: BoardSide | undefined }) {
  const flag = flagEmoji(side?.gamer?.countryIso2 ?? side?.team?.countryIso2);
  return (
    <div className={`overlay-card-player${isWinner(state, side) ? " overlay-winner" : ""}`}>
      <Avatar url={side?.gamer?.avatarUrl ?? side?.team?.logoUrl} name={sideLabel(side)} />
      <div className="overlay-card-player-name">{sideLabel(side)}</div>
      <div className="overlay-card-player-meta">
        {flag ? `${flag} ` : ""}
        {side?.gamer?.countryName ?? side?.team?.countryName ?? ""}
        {side?.gamer?.handle ? ` · @${side.gamer.handle}` : ""}
      </div>
    </div>
  );
}

export function MatchCard({ state }: { state: BoardState }) {
  if (!state.board.assigned || !state.match) return null;
  const left = state.sides.find((side) => side.slot === 1);
  const right = state.sides.find((side) => side.slot === 2);
  return (
    <div className="overlay-card overlay-panel">
      <div className="overlay-card-header">
        <div className="overlay-card-event">
          {state.tournament?.name}
          {state.division?.name ? ` — ${state.division.name}` : ""}
        </div>
        <div className="overlay-card-round">{state.match.round.label}</div>
      </div>
      <div className="overlay-card-versus">
        <CardPlayer state={state} side={left} />
        <div className="overlay-card-score">
          <span className="overlay-score-value" key={`c1-${left?.score ?? 0}`}>{left?.score ?? 0}</span>
          <span className="overlay-card-score-divider">–</span>
          <span className="overlay-score-value" key={`c2-${right?.score ?? 0}`}>{right?.score ?? 0}</span>
        </div>
        <CardPlayer state={state} side={right} />
      </div>
      <div className="overlay-card-footer">
        <span>{state.game?.name}</span>
        <span>·</span>
        <span>Best of {state.match.bestOf}</span>
        <span>·</span>
        <span>Match {state.match.code}</span>
        <StatusBadge state={state} />
      </div>
    </div>
  );
}
