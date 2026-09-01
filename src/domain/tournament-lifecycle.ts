import type { Participant } from "@/domain/tournament-engine";

export type RegistrationPolicy = {
  restricted: boolean;
  limit: number | null;
};

export type RegistrationAvailability = {
  restricted: boolean;
  limit: number | null;
  registered: number;
  remaining: number | null;
  full: boolean;
};

export type EntrantRegistration = {
  participantId: string;
  displayNameSnapshot: string;
  seed: number | null;
  eligible: boolean;
  checkedInAt: Date | null;
  status: "registered" | "confirmed" | "withdrawn" | "rejected";
};

export class LifecycleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

export function validateRegistrationPolicy(policy: RegistrationPolicy) {
  if (!policy.restricted) return { restricted: false, limit: null } as const;
  if (!Number.isInteger(policy.limit) || (policy.limit ?? 0) < 2) {
    throw new LifecycleError("INVALID_REGISTRATION_LIMIT", "A restricted tournament needs a participant limit of at least 2.", 422);
  }
  return { restricted: true, limit: policy.limit as number } as const;
}

export function getRegistrationAvailability(
  policy: RegistrationPolicy,
  registered: number,
): RegistrationAvailability {
  const validated = validateRegistrationPolicy(policy);
  if (!validated.restricted) {
    return { restricted: false, limit: null, registered, remaining: null, full: false };
  }
  const remaining = Math.max(0, validated.limit - registered);
  return {
    restricted: true,
    limit: validated.limit,
    registered,
    remaining,
    full: remaining === 0,
  };
}

export function resolveActualEntrants(registrations: EntrantRegistration[]): Participant[] {
  const entrants = registrations
    .filter((registration) =>
      (registration.status === "registered" || registration.status === "confirmed")
      && registration.eligible
      && registration.checkedInAt !== null)
    .sort((left, right) => {
      const leftSeed = left.seed ?? Number.MAX_SAFE_INTEGER;
      const rightSeed = right.seed ?? Number.MAX_SAFE_INTEGER;
      return leftSeed - rightSeed || left.displayNameSnapshot.localeCompare(right.displayNameSnapshot);
    });

  if (entrants.length < 2) {
    throw new LifecycleError("INSUFFICIENT_ENTRANTS", "At least two eligible, checked-in participants are required to start.");
  }

  return entrants.map((registration, index) => ({
    id: registration.participantId,
    name: registration.displayNameSnapshot,
    seed: index + 1,
  }));
}

export type TournamentRegistrationAction = "publish" | "open_registration" | "close_registration";

export type TournamentLifecycleStatus =
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "live"
  | "completed"
  | "cancelled"
  | "archived";

export function assertTournamentTransition(current: TournamentLifecycleStatus, action: TournamentRegistrationAction) {
  const allowed: Record<TournamentRegistrationAction, TournamentLifecycleStatus[]> = {
    publish: ["draft"],
    open_registration: ["published", "registration_closed"],
    close_registration: ["registration_open"],
  };
  if (!allowed[action].includes(current)) {
    throw new LifecycleError("INVALID_TOURNAMENT_TRANSITION", `A ${current} event cannot ${action.replaceAll("_", " ")}.`);
  }
}

export const tournamentActionTargetStatus: Record<TournamentRegistrationAction, TournamentLifecycleStatus> = {
  publish: "published",
  open_registration: "registration_open",
  close_registration: "registration_closed",
};

export type MatchLifecycleStatus =
  | "scheduled"
  | "ready"
  | "live"
  | "paused"
  | "reported"
  | "confirmed"
  | "final"
  | "disputed"
  | "forfeit"
  | "cancelled";

export function assertMatchTransition(current: MatchLifecycleStatus, target: MatchLifecycleStatus) {
  const allowed: Partial<Record<MatchLifecycleStatus, MatchLifecycleStatus[]>> = {
    scheduled: ["ready", "live", "cancelled"],
    ready: ["live", "cancelled"],
    live: ["paused", "final", "forfeit", "disputed"],
    paused: ["live", "final", "forfeit", "cancelled"],
    reported: ["confirmed", "disputed"],
    confirmed: ["final", "disputed"],
    disputed: ["live", "final", "cancelled"],
  };
  if (!allowed[current]?.includes(target)) {
    throw new LifecycleError("INVALID_MATCH_TRANSITION", `A match cannot move from ${current} to ${target}.`);
  }
}
