import { describe, expect, it } from "vitest";
import { boardVersion, toSimpleBoard, type BoardState } from "@/lib/stream-board-data";

function makeState(overrides: Partial<BoardState> = {}): BoardState {
  return {
    board: { number: 1, assigned: true, featuredSlot: 1, updatedAt: "2026-08-21T10:00:00.000Z" },
    tournament: { name: "Cup", slug: "cup" },
    division: { name: "Tekken" },
    game: { name: "Tekken 8" },
    match: {
      id: "11111111-1111-1111-1111-111111111111",
      code: "U1-M1",
      status: "live",
      bestOf: 5,
      round: { label: "Upper Round 1", lane: "upper" },
      startedAt: "2026-08-21T10:00:00.000Z",
      endedAt: null,
      updatedAt: "2026-08-21T10:05:00.000Z",
      winnerParticipantId: null,
    },
    sides: [
      { slot: 1, displayName: "A", score: 2, outcome: null, participantId: "a", participantType: "gamer", gamer: null, team: null },
      { slot: 2, displayName: "B", score: 1, outcome: null, participantId: "b", participantType: "gamer", gamer: null, team: null },
    ],
    featured: null,
    ...overrides,
  };
}

describe("boardVersion", () => {
  it("is deterministic for identical states", () => {
    expect(boardVersion(makeState())).toBe(boardVersion(makeState()));
  });

  it("changes when a score changes", () => {
    const base = makeState();
    const bumped = makeState();
    bumped.sides[1] = { ...bumped.sides[1], score: 2 };
    expect(boardVersion(bumped)).not.toBe(boardVersion(base));
  });

  it("changes when the match status changes", () => {
    const base = makeState();
    const final = makeState();
    final.match = { ...final.match!, status: "final" };
    expect(boardVersion(final)).not.toBe(boardVersion(base));
  });

  it("changes when the board is reassigned to another match", () => {
    const base = makeState();
    const reassigned = makeState();
    reassigned.match = { ...reassigned.match!, id: "22222222-2222-2222-2222-222222222222" };
    expect(boardVersion(reassigned)).not.toBe(boardVersion(base));
  });

  it("changes when the featured slot changes", () => {
    const base = makeState();
    const featured = makeState();
    featured.board = { ...featured.board, featuredSlot: 2 };
    expect(boardVersion(featured)).not.toBe(boardVersion(base));
  });

  it("distinguishes an unassigned board from an assigned one", () => {
    const unassigned = makeState({ match: null, sides: [] });
    unassigned.board = { ...unassigned.board, assigned: false };
    expect(boardVersion(unassigned)).not.toBe(boardVersion(makeState()));
  });
});

describe("toSimpleBoard", () => {
  it("flattens an assigned board into names, scores, and profile fields", () => {
    const state = makeState();
    state.sides[0].profile = {
      slot: 1,
      participantType: "gamer",
      displayName: "A",
      handle: "ACE",
      avatarUrl: "https://cdn/a.png",
      bio: "Local legend",
      countryIso2: "PK",
      countryName: "Pakistan",
      city: "Lahore",
      rankingPoints: 2100,
      games: [{ game: "Tekken 8", inGameName: "ACE", primaryRole: null, platform: "PS5" }],
      record: { played: 3, wins: 2, losses: 1, points: 6 },
      team: null,
    };
    const simple = toSimpleBoard(state);
    expect(simple).toMatchObject({
      board: 1,
      assigned: true,
      tournament: "Cup",
      game: "Tekken 8",
      matchCode: "U1-M1",
      round: "Upper Round 1",
      bestOf: 5,
      status: "live",
      featuredSlot: 1,
      winnerSlot: null,
    });
    expect(simple.version).toBe(boardVersion(state));
    expect(simple.players[0]).toMatchObject({
      slot: 1,
      name: "A",
      score: 2,
      winner: false,
      handle: "ACE",
      countryCode: "PK",
      country: "Pakistan",
      city: "Lahore",
      bio: "Local legend",
      rankingPoints: 2100,
      record: { played: 3, wins: 2, losses: 1, points: 6 },
    });
    expect(simple.players[0].games).toHaveLength(1);
    expect(simple.players[1]).toMatchObject({ slot: 2, name: "B", score: 1, winner: false });
  });

  it("marks the winner slot once the match is final", () => {
    const state = makeState();
    state.match = { ...state.match!, status: "final", winnerParticipantId: "b" };
    state.sides[1] = { ...state.sides[1], outcome: "win" };
    const simple = toSimpleBoard(state);
    expect(simple.winnerSlot).toBe(2);
    expect(simple.players[0].winner).toBe(false);
    expect(simple.players[1].winner).toBe(true);
  });

  it("renders an unassigned board as an empty player list", () => {
    const state = makeState({ match: null, sides: [] });
    state.board = { ...state.board, assigned: false };
    const simple = toSimpleBoard(state);
    expect(simple).toMatchObject({ assigned: false, matchCode: null, status: null, players: [] });
  });
});
