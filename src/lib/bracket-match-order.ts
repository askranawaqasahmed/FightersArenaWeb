export function bracketMatchOrderGroup(roundSequence: number, lane: string) {
  if (lane === "final") return Number.MAX_SAFE_INTEGER;
  return roundSequence * 2 + (lane === "lower" ? 1 : 0);
}

export function compareBracketMatchOrder(
  left: { roundSequence: number; lane: string; matchSequence: number },
  right: { roundSequence: number; lane: string; matchSequence: number },
) {
  return bracketMatchOrderGroup(left.roundSequence, left.lane) - bracketMatchOrderGroup(right.roundSequence, right.lane)
    || left.matchSequence - right.matchSequence;
}
