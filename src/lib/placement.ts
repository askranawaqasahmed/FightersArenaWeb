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

/**
 * Medal styling for a finishing position. Podium places get gold/silver/bronze;
 * everything else shares a neutral badge so the podium stays the thing you notice.
 */
export function placementMedalClass(rank: number | null | undefined): string {
  if (rank === CHAMPION_RANK) return "placement-1";
  if (rank === RUNNER_UP_RANK) return "placement-2";
  if (rank === 3) return "placement-3";
  return "placement-rest";
}

/** Short badge text: the bare number for a ranked finish, a dash when unknown. */
export function placementBadge(rank: number | null | undefined): string {
  return typeof rank === "number" && rank >= 1 ? String(rank) : "–";
}
