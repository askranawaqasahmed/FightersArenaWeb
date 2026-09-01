import { describe, expect, it } from "vitest";
import {
  createSeedOrder,
  generateDoubleElimination,
  generateRoundRobin,
  generateSingleElimination,
  validateBracket,
  type Participant,
} from "./tournament-engine";

const participants = (count: number): Participant[] => Array.from({ length: count }, (_, index) => ({
  id: `p-${index + 1}`,
  name: `Participant ${index + 1}`,
  seed: index + 1,
}));

describe("tournament engine", () => {
  it("creates balanced seed positions", () => {
    expect(createSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("generates a deterministic single-elimination bracket with byes", () => {
    const bracket = generateSingleElimination(participants(6), { bestOf: 3 });
    expect(bracket.size).toBe(8);
    expect(bracket.rounds.map((round) => round.matches.length)).toEqual([4, 2, 1]);
    expect(validateBracket(bracket)).toEqual([]);
  });

  it("generates double elimination paths and reset final", () => {
    const bracket = generateDoubleElimination(participants(8), { bestOf: 3, grandFinalReset: true });
    expect(bracket.rounds.filter((round) => round.lane === "upper")).toHaveLength(3);
    expect(bracket.rounds.filter((round) => round.lane === "lower")).toHaveLength(4);
    expect(bracket.rounds.at(-1)?.matches).toHaveLength(2);
    expect(validateBracket(bracket)).toEqual([]);
  });

  it("schedules every round-robin pairing exactly once", () => {
    const fixtures = generateRoundRobin(participants(5));
    const pairings = new Set(fixtures.map((fixture) => [fixture.home.id, fixture.away.id].sort().join(":")));
    expect(fixtures).toHaveLength(10);
    expect(pairings.size).toBe(10);
  });

  it.each([2, 3, 4, 5, 6, 8, 16, 32, 48, 64])(
    "generates valid single and double elimination graphs for %i actual entrants",
    (participantCount) => {
      const single = generateSingleElimination(participants(participantCount));
      const double = generateDoubleElimination(participants(participantCount));
      const expectedSize = 2 ** Math.ceil(Math.log2(participantCount));
      expect(single.size).toBe(expectedSize);
      expect(double.size).toBe(expectedSize);
      expect(validateBracket(single)).toEqual([]);
      expect(validateBracket(double)).toEqual([]);
    },
  );

  it.each([2, 3, 4, 5, 8, 16])("creates complete round-robin schedules for %i entrants", (participantCount) => {
    const fixtures = generateRoundRobin(participants(participantCount));
    expect(fixtures).toHaveLength(participantCount * (participantCount - 1) / 2);
    expect(new Set(fixtures.map((fixture) => [fixture.home.id, fixture.away.id].sort().join(":"))).size)
      .toBe(fixtures.length);
  });
});
