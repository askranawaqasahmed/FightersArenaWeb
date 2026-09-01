import { describe, expect, it } from "vitest";
import {
  bracketVersion,
  formatDateRange,
  publicFormatLabel,
  publicStatusLabel,
  publicTournamentStatuses,
  type PublicMatch,
} from "@/lib/public-tournament-data";

function match(code: string, status: string, scores: [number, number], outcomes: [string | null, string | null] = [null, null]): PublicMatch {
  return {
    id: `id-${code}`,
    code,
    matchNumber: 1,
    status,
    bestOf: 3,
    round: "Round 1",
    roundSequence: 1,
    lane: "main",
    startedAt: null,
    endedAt: null,
    winnerParticipantId: null,
    sides: [
      { slot: 1, participantId: "a", name: "A", seed: 1, score: scores[0], outcome: outcomes[0], sourceMatchCode: null, sourceOutcome: null, participantType: "gamer", profileSlug: "a" },
      { slot: 2, participantId: "b", name: "B", seed: 2, score: scores[1], outcome: outcomes[1], sourceMatchCode: null, sourceOutcome: null, participantType: "gamer", profileSlug: "b" },
    ],
  };
}

describe("public visibility rules", () => {
  it("never exposes drafts, cancellations or archives", () => {
    expect(publicTournamentStatuses).not.toContain("draft");
    expect(publicTournamentStatuses).not.toContain("cancelled");
    expect(publicTournamentStatuses).not.toContain("archived");
  });

  it("exposes a tournament as soon as it goes live, and after completion", () => {
    expect(publicTournamentStatuses).toContain("live");
    expect(publicTournamentStatuses).toContain("completed");
    expect(publicTournamentStatuses).toContain("registration_open");
  });
});

describe("public labels", () => {
  it("maps database statuses to broadcast-friendly labels", () => {
    expect(publicStatusLabel("live")).toBe("LIVE");
    expect(publicStatusLabel("registration_open")).toBe("REGISTERING");
    expect(publicStatusLabel("completed")).toBe("COMPLETED");
  });

  it("falls back to a readable label for unmapped statuses", () => {
    expect(publicStatusLabel("some_new_status")).toBe("SOME NEW STATUS");
  });

  it("labels a not-yet-started competition for spectators rather than showing DRAFT", () => {
    expect(publicStatusLabel("draft")).toBe("NOT STARTED");
  });

  it("names each bracket format", () => {
    expect(publicFormatLabel("double_elimination")).toBe("Double Elimination");
    expect(publicFormatLabel("round_robin")).toBe("Round Robin");
    expect(publicFormatLabel(null)).toBe("Format to be announced");
  });
});

describe("formatDateRange", () => {
  it("handles a single-day event", () => {
    const day = new Date("2026-09-20T10:00:00Z");
    expect(formatDateRange(day, day)).toMatch(/2026/);
  });

  it("handles a missing start date", () => {
    expect(formatDateRange(null, null)).toBe("Dates to be announced");
  });

  it("renders a multi-day range with a separator", () => {
    const range = formatDateRange(new Date("2026-08-18T10:00:00Z"), new Date("2026-08-24T10:00:00Z"));
    expect(range).toContain("–");
  });
});

describe("bracketVersion", () => {
  it("is stable for identical bracket state", () => {
    const a = [match("U1-M1", "live", [1, 0])];
    const b = [match("U1-M1", "live", [1, 0])];
    expect(bracketVersion(a)).toBe(bracketVersion(b));
  });

  it("changes when a score changes", () => {
    expect(bracketVersion([match("U1-M1", "live", [2, 0])]))
      .not.toBe(bracketVersion([match("U1-M1", "live", [1, 0])]));
  });

  it("changes when a match starts", () => {
    expect(bracketVersion([match("U1-M1", "live", [0, 0])]))
      .not.toBe(bracketVersion([match("U1-M1", "ready", [0, 0])]));
  });

  it("changes when a result is recorded", () => {
    expect(bracketVersion([match("U1-M1", "final", [2, 1], ["win", "loss"])]))
      .not.toBe(bracketVersion([match("U1-M1", "live", [2, 1])]));
  });
});
