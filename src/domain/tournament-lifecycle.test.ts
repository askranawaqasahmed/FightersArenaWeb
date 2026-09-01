import { describe, expect, it } from "vitest";
import {
  assertMatchTransition,
  assertTournamentTransition,
  getRegistrationAvailability,
  LifecycleError,
  resolveActualEntrants,
  tournamentActionTargetStatus,
  validateRegistrationPolicy,
  type TournamentLifecycleStatus,
  type TournamentRegistrationAction,
} from "./tournament-lifecycle";

describe("tournament registration lifecycle", () => {
  const allStatuses: TournamentLifecycleStatus[] = ["draft", "published", "registration_open", "registration_closed", "live", "completed", "cancelled", "archived"];
  const allowed: Record<TournamentRegistrationAction, TournamentLifecycleStatus[]> = {
    publish: ["draft"],
    open_registration: ["published", "registration_closed"],
    close_registration: ["registration_open"],
  };

  it("allows exactly the legal transitions and rejects every other status", () => {
    for (const action of Object.keys(allowed) as TournamentRegistrationAction[]) {
      for (const status of allStatuses) {
        if (allowed[action].includes(status)) {
          expect(() => assertTournamentTransition(status, action)).not.toThrow();
        } else {
          expect(() => assertTournamentTransition(status, action)).toThrowError(LifecycleError);
        }
      }
    }
  });

  it("maps each action to its target status", () => {
    expect(tournamentActionTargetStatus.publish).toBe("published");
    expect(tournamentActionTargetStatus.open_registration).toBe("registration_open");
    expect(tournamentActionTargetStatus.close_registration).toBe("registration_closed");
  });
});

describe("registration policy", () => {
  it("never fills an unrestricted competition", () => {
    expect(getRegistrationAvailability({ restricted: false, limit: 32 }, 500)).toEqual({
      restricted: false,
      limit: null,
      registered: 500,
      remaining: null,
      full: false,
    });
  });

  it("marks a restricted competition full at its optional limit", () => {
    expect(getRegistrationAvailability({ restricted: true, limit: 32 }, 32)).toMatchObject({
      remaining: 0,
      full: true,
    });
    expect(getRegistrationAvailability({ restricted: true, limit: 32 }, 31)).toMatchObject({
      remaining: 1,
      full: false,
    });
  });

  it("rejects invalid limits only when restriction is enabled", () => {
    expect(validateRegistrationPolicy({ restricted: false, limit: 1 })).toEqual({ restricted: false, limit: null });
    expect(() => validateRegistrationPolicy({ restricted: true, limit: 1 })).toThrow(LifecycleError);
  });
});

describe("actual tournament entrants", () => {
  it("uses eligible checked-in registrations and reseeds the actual count", () => {
    const registrations = Array.from({ length: 64 }, (_, index) => ({
      participantId: crypto.randomUUID(),
      displayNameSnapshot: `Player ${index + 1}`,
      seed: index + 1,
      eligible: index < 48,
      checkedInAt: index < 48 ? new Date() : null,
      status: "confirmed" as const,
    }));
    const entrants = resolveActualEntrants(registrations);
    expect(entrants).toHaveLength(48);
    expect(entrants.at(-1)?.seed).toBe(48);
  });

  it("excludes withdrawn participants even if they checked in", () => {
    expect(() => resolveActualEntrants([
      { participantId: crypto.randomUUID(), displayNameSnapshot: "One", seed: 1, eligible: true, checkedInAt: new Date(), status: "withdrawn" },
      { participantId: crypto.randomUUID(), displayNameSnapshot: "Two", seed: 2, eligible: true, checkedInAt: new Date(), status: "confirmed" },
    ])).toThrowError(/At least two/);
  });
});

describe("match controls", () => {
  it("supports start, pause, resume, and finish transitions", () => {
    expect(() => assertMatchTransition("ready", "live")).not.toThrow();
    expect(() => assertMatchTransition("live", "paused")).not.toThrow();
    expect(() => assertMatchTransition("paused", "live")).not.toThrow();
    expect(() => assertMatchTransition("live", "final")).not.toThrow();
  });

  it("does not reopen a final match", () => {
    expect(() => assertMatchTransition("final", "live")).toThrowError(/cannot move/);
  });
});
