"use client";

import { ChevronDown, ChevronUp, Hand, Radio } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { Bracket, GeneratedMatch, GeneratedRound, SlotSource } from "@/domain/tournament-engine";
import { compareBracketMatchOrder } from "@/lib/bracket-match-order";

const cardWidth = 272;
const detailedCardHeight = 138;
const compactCardHeight = 95;
const columnGap = 92;
const columnPitch = cardWidth + columnGap;
const matchGap = 28;
const laneHeaderHeight = 104;
const laneGap = 28;
const canvasGutter = 32;

type PositionedMatch = {
  match: GeneratedMatch;
  round: GeneratedRound;
  left: number;
  top: number;
  centerY: number;
};

type PositionedRound = {
  round: GeneratedRound;
  lane: GeneratedMatch["lane"];
  left: number;
  top: number;
  roundNumber: number;
};

type LaneLandmark = {
  lane: GeneratedMatch["lane"];
  left: number;
  top: number;
};

type BracketLayout = {
  width: number;
  height: number;
  positions: PositionedMatch[];
  rounds: PositionedRound[];
  landmarks: LaneLandmark[];
};

type Destination = {
  code: string;
  label: string;
};

export type BracketMatchState = {
  code: string;
  matchNumber: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  sides: Array<{ score: number; outcome: string | null }>;
};

function slotLabel(slot: SlotSource) {
  if (slot.type === "participant") return slot.participant.seed > 0
    ? `#${slot.participant.seed} ${slot.participant.name}`
    : slot.participant.name;
  if (slot.type === "match") return `${slot.outcome === "winner" ? "Winner" : "Loser"} of ${slot.matchCode}`;
  return "BYE";
}

function laneTitle(lane: GeneratedMatch["lane"]) {
  if (lane === "upper") return { title: "Upper bracket", detail: "Winners continue toward the upper final" };
  if (lane === "lower") return { title: "Lower bracket", detail: "One more loss eliminates the participant" };
  if (lane === "final") return { title: "Grand final", detail: "Upper champion versus lower champion" };
  return { title: "Championship bracket", detail: "Every winner advances to the next round" };
}

function finalRounds(bracket: Bracket): GeneratedRound[] {
  return bracket.rounds
    .filter((round) => round.lane === "final")
    .flatMap((round) => round.matches.map((match, index) => ({
      sequence: index + 1,
      label: index === 0 ? "Grand Final" : "Bracket Reset",
      lane: "final" as const,
      matches: [match],
    })));
}

function roundsForLane(bracket: Bracket, lane: GeneratedMatch["lane"]) {
  if (lane === "final") return finalRounds(bracket);
  return bracket.rounds.filter((round) => round.lane === lane);
}

function destinationText(destination: Destination | undefined, fallback: string) {
  return destination ? `${destination.label} · ${destination.code}` : fallback;
}

function positionLane(rounds: GeneratedRound[], lane: GeneratedMatch["lane"], top: number, cardHeight: number) {
  const largestRound = Math.max(...rounds.map((round) => round.matches.length), 1);
  const rowPitch = cardHeight + matchGap;
  const matchAreaHeight = Math.max(rowPitch, largestRound * rowPitch);
  const positions = rounds.flatMap((round, roundIndex) => round.matches.map((match, matchIndex) => {
    const centerY = top + laneHeaderHeight + (matchIndex + 0.5) * (matchAreaHeight / round.matches.length);
    return {
      match,
      round,
      left: roundIndex * columnPitch,
      top: centerY - cardHeight / 2,
      centerY,
    } satisfies PositionedMatch;
  }));
  const positionedRounds = rounds.map((round, roundIndex) => ({
    round,
    lane,
    left: roundIndex * columnPitch,
    top: top + 58,
    roundNumber: roundIndex + 1,
  }));

  return {
    height: laneHeaderHeight + matchAreaHeight,
    positions,
    rounds: positionedRounds,
  };
}

function createBracketLayout(bracket: Bracket, cardHeight: number): BracketLayout {
  if (bracket.format === "single_elimination") {
    const mainRounds = roundsForLane(bracket, "main");
    const main = positionLane(mainRounds, "main", 0, cardHeight);
    return {
      width: Math.max(1, mainRounds.length) * cardWidth + Math.max(0, mainRounds.length - 1) * columnGap + canvasGutter,
      height: main.height + canvasGutter,
      positions: main.positions,
      rounds: main.rounds,
      landmarks: [{ lane: "main", left: 0, top: 0 }],
    };
  }

  const upperRounds = roundsForLane(bracket, "upper");
  const lowerRounds = roundsForLane(bracket, "lower");
  const championshipRounds = roundsForLane(bracket, "final");
  const upper = positionLane(upperRounds, "upper", 0, cardHeight);
  const lowerTop = upper.height + laneGap;
  const lower = positionLane(lowerRounds, "lower", lowerTop, cardHeight);
  const preliminaryPositions = [...upper.positions, ...lower.positions];
  const preliminaryByCode = new Map(preliminaryPositions.map((position) => [position.match.code, position]));
  const finalColumn = Math.max(upperRounds.length, lowerRounds.length);
  const finalLeft = finalColumn * columnPitch;
  const upperFinal = upperRounds.at(-1)?.matches.at(-1);
  const lowerFinal = lowerRounds.at(-1)?.matches.at(-1);
  const upperFinalCenter = upperFinal ? preliminaryByCode.get(upperFinal.code)?.centerY : undefined;
  const lowerFinalCenter = lowerFinal ? preliminaryByCode.get(lowerFinal.code)?.centerY : undefined;
  const finalCenter = upperFinalCenter !== undefined && lowerFinalCenter !== undefined
    ? (upperFinalCenter + lowerFinalCenter) / 2
    : upper.height;
  const finalPositions = championshipRounds.flatMap((round, roundIndex) => round.matches.map((match) => ({
    match,
    round,
    left: finalLeft + roundIndex * columnPitch,
    top: finalCenter - cardHeight / 2,
    centerY: finalCenter,
  } satisfies PositionedMatch)));
  const finalPositionedRounds = championshipRounds.map((round, roundIndex) => ({
    round,
    lane: "final" as const,
    left: finalLeft + roundIndex * columnPitch,
    top: finalCenter - cardHeight / 2 - 50,
    roundNumber: roundIndex + 1,
  }));
  const positions = [...preliminaryPositions, ...finalPositions];
  const rightEdge = Math.max(...positions.map((position) => position.left + cardWidth));
  const bottomEdge = Math.max(lowerTop + lower.height, ...positions.map((position) => position.top + cardHeight));

  return {
    width: rightEdge + canvasGutter,
    height: bottomEdge + canvasGutter,
    positions,
    rounds: [...upper.rounds, ...lower.rounds, ...finalPositionedRounds],
    landmarks: [
      { lane: "upper", left: 0, top: 0 },
      { lane: "lower", left: 0, top: lowerTop },
      { lane: "final", left: finalLeft, top: Math.max(0, finalCenter - cardHeight / 2 - 126) },
    ],
  };
}

function connectorPath(source: PositionedMatch, target: PositionedMatch, slotIndex: number, cardHeight: number) {
  const endX = target.left;
  const endY = target.top + 25 + (slotIndex + 0.5) * 35;
  const dropsToAnotherLane = target.match.lane !== source.match.lane && target.top > source.top;

  if (dropsToAnotherLane) {
    const startX = source.left + cardWidth / 2;
    const startY = source.top + cardHeight;
    const railY = startY + Math.max(24, (endY - startY) / 2);
    return `M ${startX} ${startY} V ${railY} H ${endX} V ${endY}`;
  }

  const startX = source.left + cardWidth;
  const startY = source.centerY;
  if (endX >= startX) {
    const middleX = startX + (endX - startX) / 2;
    return `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;
  }

  const railY = source.top - 24;
  return `M ${startX} ${startY} H ${startX + columnGap / 2} V ${railY} H ${endX} V ${endY}`;
}

function MatchCard({
  positioned,
  winnerDestination,
  loserDestination,
  state,
  matchNumber,
  cardHeight,
  showDetails,
}: {
  positioned: PositionedMatch;
  winnerDestination?: Destination;
  loserDestination?: Destination;
  state?: BracketMatchState;
  matchNumber: number;
  cardHeight: number;
  showDetails: boolean;
}) {
  const { match } = positioned;
  const style = {
    "--match-left": `${positioned.left}px`,
    "--match-top": `${positioned.top}px`,
    "--match-width": `${cardWidth}px`,
    "--match-height": `${cardHeight}px`,
  } as CSSProperties;
  const showLoserPath = match.lane === "upper" || match.lane === "lower" || match.lane === "final";
  const isLive = state?.status === "live";
  const showScores = isLive || state?.status === "final" || state?.status === "forfeit";
  return (
    <article className={`connected-match match-${match.lane}${isLive ? " is-live" : ""}`} style={style} aria-label={`${positioned.round.label}, match ${match.code}`}>
      <header><span>{`MATCH #${matchNumber} · ${match.code}`}</span>{isLive ? <span className="connected-match-live" aria-label="Live match"><Radio size={11} aria-hidden="true" /> LIVE</span> : showDetails && <span>BO{match.bestOf}</span>}</header>
      <div className="connected-match-sides">
        {match.slots.map((slot, slotIndex) => <div className={`connected-match-side${state?.sides[slotIndex]?.outcome === "win" ? " winner" : ""}`} key={`${match.code}-${slotIndex}`}><span className="slot-number">{slotIndex + 1}</span><strong>{slotLabel(slot)}</strong><span className="match-score">{showScores ? state?.sides[slotIndex]?.score ?? 0 : "—"}</span></div>)}
      </div>
      {showDetails && <footer>
        <span className="qualification winner-path">W → {destinationText(winnerDestination, match.lane === "final" ? "Champion" : "Advances")}</span>
        {showLoserPath && <span className="qualification loser-path">L → {destinationText(loserDestination, "Eliminated")}</span>}
      </footer>}
    </article>
  );
}

function PannableBracket({
  bracket,
  matchStates,
  matchNumbers,
  winnerDestinations,
  loserDestinations,
}: {
  bracket: Bracket;
  matchStates: Map<string, BracketMatchState>;
  matchNumbers: Map<string, number>;
  winnerDestinations: Map<string, Destination>;
  loserDestinations: Map<string, Destination>;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const cardHeight = showDetails ? detailedCardHeight : compactCardHeight;
  const layout = createBracketLayout(bracket, cardHeight);
  const byCode = new Map(layout.positions.map((position) => [position.match.code, position]));

  function startPanning(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.setPointerCapture?.(event.pointerId);
    setDragging(true);
    event.preventDefault();
  }

  function pan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport || drag.pointerId !== event.pointerId) return;
    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
  }

  function stopPanning(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (viewport?.hasPointerCapture?.(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  const label = bracket.format === "double_elimination" ? "Double-elimination bracket map" : "Single-elimination bracket map";
  return (
    <section className="connected-bracket-map" aria-label={label}>
      <div className="connected-bracket-toolbar">
        <div className="bracket-line-legend"><span className="winner-line">Winner</span></div>
        <div className="bracket-tools">
          <button className="bracket-details-toggle" type="button" aria-expanded={showDetails} onClick={() => setShowDetails((visible) => !visible)}>{showDetails ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}{showDetails ? "Hide details" : "Show details"}</button>
          <span className="bracket-hand-tool"><Hand size={14} aria-hidden="true" /> Drag to pan</span>
        </div>
      </div>
      <div
        className={`connected-bracket-scroll${dragging ? " is-dragging" : ""}`}
        ref={viewportRef}
        role="region"
        aria-label="Bracket preview. Drag with the hand tool or use the scrollbars to pan."
        tabIndex={0}
        onPointerDown={startPanning}
        onPointerMove={pan}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
      >
        <div className="connected-bracket-canvas" style={{ width: layout.width, height: layout.height }}>
          {layout.landmarks.map((landmark) => {
            const heading = laneTitle(landmark.lane);
            return <div className={`connected-lane-heading lane-${landmark.lane}`} style={{ left: landmark.left, top: landmark.top }} key={landmark.lane}><span className="status">{heading.title}</span>{showDetails && <h4>{heading.detail}</h4>}</div>;
          })}
          {layout.rounds.map((positionedRound) => <div className={`connected-round-title lane-${positionedRound.lane}`} style={{ left: positionedRound.left, top: positionedRound.top, width: cardWidth }} key={`${positionedRound.lane}-${positionedRound.round.label}-${positionedRound.roundNumber}`}><span>ROUND {positionedRound.roundNumber}</span><strong>{positionedRound.round.label}</strong></div>)}
          <svg className="bracket-connectors" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
            {layout.positions.flatMap((target) => target.match.slots.flatMap((slot, slotIndex) => {
              if (slot.type !== "match" || slot.outcome !== "winner") return [];
              const source = byCode.get(slot.matchCode);
              if (!source) return [];
              return <path className="connector-winner" d={connectorPath(source, target, slotIndex, cardHeight)} data-source={slot.matchCode} data-target={target.match.code} key={`${target.match.code}-${slotIndex}-${slot.matchCode}`} />;
            }))}
          </svg>
          {layout.positions.map((position) => <MatchCard positioned={position} state={matchStates.get(position.match.code)} matchNumber={matchStates.get(position.match.code)?.matchNumber ?? matchNumbers.get(position.match.code) ?? 0} winnerDestination={winnerDestinations.get(position.match.code)} loserDestination={loserDestinations.get(position.match.code)} cardHeight={cardHeight} showDetails={showDetails} key={position.match.code} />)}
        </div>
      </div>
    </section>
  );
}

export function ConnectedEliminationBracket({ bracket, matches = [] }: { bracket: Bracket; matches?: BracketMatchState[] }) {
  const labels = new Map<string, Destination>();
  const displayRounds = bracket.format === "double_elimination"
    ? [...bracket.rounds.filter((round) => round.lane !== "final"), ...finalRounds(bracket)]
    : bracket.rounds;
  for (const round of displayRounds) {
    for (const match of round.matches) labels.set(match.code, { code: match.code, label: round.label });
  }
  const winnerDestinations = new Map<string, Destination>();
  const loserDestinations = new Map<string, Destination>();
  const matchStates = new Map(matches.map((match) => [match.code, match]));
  const orderedMatches = bracket.rounds.flatMap((round) => round.matches.map((match, matchIndex) => ({
    code: match.code,
    roundSequence: match.round,
    lane: match.lane,
    matchSequence: matchIndex + 1,
  }))).sort(compareBracketMatchOrder);
  const matchNumbers = new Map(orderedMatches.map((match, index) => [match.code, index + 1]));
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      for (const slot of match.slots) {
        if (slot.type !== "match") continue;
        const destination = labels.get(match.code) ?? { code: match.code, label: round.label };
        if (slot.outcome === "winner") winnerDestinations.set(slot.matchCode, destination);
        else loserDestinations.set(slot.matchCode, destination);
      }
    }
  }

  return (
    <div className="connected-elimination-bracket">
      <PannableBracket bracket={bracket} matchStates={matchStates} matchNumbers={matchNumbers} winnerDestinations={winnerDestinations} loserDestinations={loserDestinations} />
    </div>
  );
}
