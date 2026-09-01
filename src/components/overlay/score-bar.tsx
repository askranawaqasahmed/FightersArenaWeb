import type { BoardState } from "@/lib/stream-board-data";
import { Avatar, StatusBadge, flagEmoji, isWinner, sideLabel } from "@/components/overlay/overlay-bits";

export function ScoreBar({ state }: { state: BoardState }) {
  if (!state.board.assigned || !state.match) return null;
  const [left, right] = [state.sides.find((side) => side.slot === 1), state.sides.find((side) => side.slot === 2)];
  const leftFlag = flagEmoji(left?.gamer?.countryIso2 ?? left?.team?.countryIso2);
  const rightFlag = flagEmoji(right?.gamer?.countryIso2 ?? right?.team?.countryIso2);
  return (
    <div className="overlay-bar overlay-panel">
      <div className={`overlay-bar-side left${isWinner(state, left) ? " overlay-winner" : ""}`}>
        <Avatar url={left?.gamer?.avatarUrl ?? left?.team?.logoUrl} name={sideLabel(left)} />
        <div>
          <div className="overlay-bar-name">
            {leftFlag && <span className="overlay-flag">{leftFlag} </span>}
            {sideLabel(left)}
          </div>
          {left?.gamer?.handle && <div className="overlay-bar-handle">@{left.gamer.handle}</div>}
        </div>
      </div>
      <div className="overlay-bar-score">
        <span className="overlay-score-value" key={`s1-${left?.score ?? 0}`}>{left?.score ?? 0}</span>
      </div>
      <div className="overlay-bar-center">
        <div className="overlay-bar-round">{state.match.round.label}</div>
        <div className="overlay-bar-meta">
          <span>{state.game?.name}</span>
          <span>·</span>
          <span>BO{state.match.bestOf}</span>
          <StatusBadge state={state} />
        </div>
      </div>
      <div className="overlay-bar-score">
        <span className="overlay-score-value" key={`s2-${right?.score ?? 0}`}>{right?.score ?? 0}</span>
      </div>
      <div className={`overlay-bar-side right${isWinner(state, right) ? " overlay-winner" : ""}`}>
        <Avatar url={right?.gamer?.avatarUrl ?? right?.team?.logoUrl} name={sideLabel(right)} />
        <div>
          <div className="overlay-bar-name">
            {sideLabel(right)}
            {rightFlag && <span className="overlay-flag"> {rightFlag}</span>}
          </div>
          {right?.gamer?.handle && <div className="overlay-bar-handle">@{right.gamer.handle}</div>}
        </div>
      </div>
    </div>
  );
}
