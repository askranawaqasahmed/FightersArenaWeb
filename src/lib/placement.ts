export const CHAMPION_RANK = 1;
export const RUNNER_UP_RANK = 2;

export function placementLabel(rank: number | null | undefined, label?: string | null): string {
  if (label) return label;
  if (!rank || rank < 1) return "—";
  if (rank === CHAMPION_RANK) return "Champion";
  if (rank === RUNNER_UP_RANK) return "Runner-up";
  return `Top ${rank}`;
}

export function isTitle(rank: number | null | undefined): boolean {
  return rank === CHAMPION_RANK;
}

export function isPodium(rank: number | null | undefined): boolean {
  return typeof rank === "number" && rank >= 1 && rank <= 3;
}
