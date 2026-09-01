// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCompetitionLifecycle } from "./admin-competition-lifecycle";
import type { AdminLifecycleCompetition } from "@/lib/admin-events";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const competition: AdminLifecycleCompetition = {
  tournamentId: "11111111-1111-4111-8111-111111111111",
  divisionId: "22222222-2222-4222-8222-222222222222",
  name: "Tekken Open",
  game: "Tekken 8",
  status: "READY",
  actualParticipants: 8,
  totalMatches: 0,
  unfinishedMatches: 0,
};

const validPreview = {
  data: {
    division: { id: competition.divisionId, name: competition.name, status: "draft", competitionType: "tournament" },
    validation: { valid: true, errors: [], warnings: [], actualParticipants: 8, generatedSize: 8 },
    stage: { id: "stage", name: "Playoffs", format: "double_elimination", status: "draft" },
    bracket: null,
    matches: [{ id: "preview-1", code: "U1-M1", matchNumber: 1, status: "preview", bestOf: 3, round: "Upper Quarterfinals", roundSequence: 1, lane: "upper", startedAt: null, endedAt: null, sides: [{ participantId: "one", name: "Seed 1", score: 0, outcome: null }, { participantId: "two", name: "Seed 8", score: 0, outcome: null }] }],
  },
};

// The preview flow also loads /api/v1/admin/boards; answer it separately so the
// sequential mocks (and their call-count assertions) only see lifecycle traffic.
function withBoardsStub(fetchMock: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/v1/admin/boards") {
      return Promise.resolve(new Response(JSON.stringify({ data: { boards: [] } }), { status: 200 }));
    }
    return fetchMock(input, init);
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("AdminCompetitionLifecycle", () => {
  it("opens an isolated preview for one game tournament", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(validPreview), { status: 200 }));
    vi.stubGlobal("fetch", withBoardsStub(fetchMock));
    render(<AdminCompetitionLifecycle competition={competition} />);

    fireEvent.click(screen.getByRole("button", { name: "Preview bracket & matches" }));

    expect(await screen.findByRole("region", { name: "Tekken Open preview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tekken Open only" })).toBeInTheDocument();
    expect(screen.getByText("Seed 1 vs Seed 8")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs preflight validation before sending the start action", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(validPreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "live" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...validPreview.data, matches: [{ ...validPreview.data.matches[0], status: "ready" }] } }), { status: 200 }));
    vi.stubGlobal("fetch", withBoardsStub(fetchMock));
    render(<AdminCompetitionLifecycle competition={competition} />);

    fireEvent.click(screen.getByRole("button", { name: "Start tournament" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: "no-store" });
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", body: JSON.stringify({ action: "start" }) });
    expect(screen.getByRole("button", { name: "Start match" })).toBeEnabled();
    expect(refresh).toHaveBeenCalled();
  });

  it("starts a ready match after the tournament is live", async () => {
    const liveCompetition = { ...competition, status: "LIVE" as const, totalMatches: 1, unfinishedMatches: 1 };
    const livePreview = { data: { ...validPreview.data, matches: [{ ...validPreview.data.matches[0], id: "33333333-3333-4333-8333-333333333333", status: "ready" }] } };
    const startedPreview = { data: { ...livePreview.data, matches: [{ ...livePreview.data.matches[0], status: "live", startedAt: new Date(Date.now() - 65_000).toISOString() }] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(livePreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "live" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(startedPreview), { status: 200 }));
    vi.stubGlobal("fetch", withBoardsStub(fetchMock));
    render(<AdminCompetitionLifecycle competition={liveCompetition} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage matches" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start U1-M1 from top controls" }));

    expect(await screen.findByText("U1-M1 started. The match is now live.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      "/api/v1/admin/matches/33333333-3333-4333-8333-333333333333/lifecycle",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "start" }) }),
    );
    expect(screen.getByRole("button", { name: "End match" })).toBeInTheDocument();
    expect(screen.getByText(/Live for 01:0\d/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("ends a live match with scores and refreshes the advanced bracket paths", async () => {
    const liveCompetition = { ...competition, status: "LIVE" as const, totalMatches: 2, unfinishedMatches: 2 };
    const liveMatch = {
      ...validPreview.data.matches[0],
      id: "33333333-3333-4333-8333-333333333333",
      status: "live",
      startedAt: "2026-08-21T10:00:00.000Z",
      sides: [
        { participantId: "11111111-1111-4111-8111-111111111111", name: "Alpha", score: 0, outcome: null },
        { participantId: "22222222-2222-4222-8222-222222222222", name: "Beta", score: 0, outcome: null },
      ],
    };
    const waitingLowerMatch = {
      ...validPreview.data.matches[0],
      id: "44444444-4444-4444-8444-444444444444",
      code: "L1-M1",
      status: "scheduled",
      round: "Lower Round 1",
      lane: "lower",
      sides: [
        { participantId: null, name: null, score: 0, outcome: null },
        { participantId: null, name: null, score: 0, outcome: null },
      ],
    };
    const livePreview = { data: { ...validPreview.data, stage: { ...validPreview.data.stage, format: "double_elimination" }, matches: [liveMatch, waitingLowerMatch] } };
    const finishedPreview = { data: { ...livePreview.data, matches: [
      { ...liveMatch, status: "final", endedAt: "2026-08-21T10:03:00.000Z", sides: [{ ...liveMatch.sides[0], score: 2, outcome: "win" }, { ...liveMatch.sides[1], score: 1, outcome: "loss" }] },
      { ...waitingLowerMatch, status: "ready", sides: [{ participantId: liveMatch.sides[1].participantId, name: "Beta", score: 0, outcome: null }, { participantId: "55555555-5555-4555-8555-555555555555", name: "Gamma", score: 0, outcome: null }] },
    ] } };
    const correctedPreview = { data: { ...finishedPreview.data, matches: [
      { ...finishedPreview.data.matches[0], sides: [{ ...liveMatch.sides[0], score: 1, outcome: "loss" }, { ...liveMatch.sides[1], score: 2, outcome: "win" }] },
      { ...waitingLowerMatch, status: "ready", sides: [{ participantId: liveMatch.sides[0].participantId, name: "Alpha", score: 0, outcome: null }, { participantId: "55555555-5555-4555-8555-555555555555", name: "Gamma", score: 0, outcome: null }] },
    ] } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(livePreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "final" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(finishedPreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: "final", resultVersion: 2 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(correctedPreview), { status: 200 }));
    vi.stubGlobal("fetch", withBoardsStub(fetchMock));
    render(<AdminCompetitionLifecycle competition={liveCompetition} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage matches" }));
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Alpha score for U1-M1" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Beta score for U1-M1" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "End match" }));

    expect(await screen.findByText(/Alpha advanced and both players were routed/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      "/api/v1/admin/matches/33333333-3333-4333-8333-333333333333/lifecycle",
      expect.objectContaining({ method: "POST", body: JSON.stringify({
        action: "finish",
        winnerParticipantId: "11111111-1111-4111-8111-111111111111",
        scores: [2, 1],
        startNext: false,
      }) }),
    );
    expect(screen.getByText("Beta vs Gamma")).toBeInTheDocument();
    expect(screen.getByText("Finished in 03:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit score for U1-M1" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Alpha score for U1-M1" }), { target: { value: "1" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Beta score for U1-M1" }), { target: { value: "2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Reason for correcting U1-M1" }), { target: { value: "Operator entered the sides in reverse" } });
    fireEvent.click(screen.getByRole("button", { name: "Save score changes for U1-M1" }));

    expect(await screen.findByText(/U1-M1 was corrected to 1–2/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(4,
      "/api/v1/admin/matches/33333333-3333-4333-8333-333333333333/lifecycle",
      expect.objectContaining({ method: "POST", body: JSON.stringify({
        action: "edit_result",
        winnerParticipantId: "22222222-2222-4222-8222-222222222222",
        scores: [1, 2],
        reason: "Operator entered the sides in reverse",
      }) }),
    );
    expect(screen.getByText("Alpha vs Gamma")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows live matches first and uses stable bracket-wide match numbers", async () => {
    const liveCompetition = { ...competition, status: "LIVE" as const, totalMatches: 8, unfinishedMatches: 6 };
    const baseMatch = validPreview.data.matches[0];
    const livePreview = { data: { ...validPreview.data, matches: [
      { ...baseMatch, id: "final", code: "M-FINAL", status: "final" },
      { ...baseMatch, id: "scheduled", code: "M-SCHEDULED", status: "scheduled" },
      { ...baseMatch, id: "ready-lower", code: "L1-M1", matchNumber: 5, status: "ready", lane: "lower", roundSequence: 1 },
      { ...baseMatch, id: "live-lower", code: "L1-M2", matchNumber: 6, status: "live", lane: "lower", roundSequence: 1 },
      { ...baseMatch, id: "ready-upper-4", code: "U1-M4", matchNumber: 4, status: "ready", lane: "upper", roundSequence: 1 },
      { ...baseMatch, id: "live-upper", code: "U1-M2", matchNumber: 2, status: "live", lane: "upper", roundSequence: 1 },
      { ...baseMatch, id: "ready-upper-3", code: "U1-M3", matchNumber: 3, status: "ready", lane: "upper", roundSequence: 1 },
      { ...baseMatch, id: "cancelled", code: "M-CANCELLED", status: "cancelled" },
    ] } };
    vi.stubGlobal("fetch", withBoardsStub(vi.fn().mockResolvedValue(new Response(JSON.stringify(livePreview), { status: 200 }))));
    render(<AdminCompetitionLifecycle competition={liveCompetition} />);

    fireEvent.click(screen.getByRole("button", { name: "Manage matches" }));

    const table = await screen.findByRole("table");
    const matchCodes = within(table).getAllByRole("row").slice(1).map((row) => row.querySelector(".match-code-label")?.textContent);
    expect(matchCodes).toEqual(["U1-M2", "L1-M2", "U1-M3", "U1-M4", "L1-M1", "M-SCHEDULED", "M-FINAL", "M-CANCELLED"]);
    expect(within(table).getByText("Match #3")).toBeInTheDocument();
  });

  it("recovers a blocked start by adding eligible checked-in dummy players", async () => {
    const emptyCompetition = { ...competition, actualParticipants: 0 };
    const blockedPreview = { data: {
      ...validPreview.data,
      validation: { valid: false, errors: [{ code: "INSUFFICIENT_ENTRANTS", message: "At least two eligible, checked-in participants are required to start." }], warnings: [], actualParticipants: 0, generatedSize: null },
      matches: [],
    } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(blockedPreview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        divisionId: competition.divisionId,
        actualParticipants: 8,
        status: "READY",
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(validPreview), { status: 200 }));
    vi.stubGlobal("fetch", withBoardsStub(fetchMock));
    render(<AdminCompetitionLifecycle competition={emptyCompetition} />);

    fireEvent.click(screen.getByRole("button", { name: "Start tournament" }));
    expect(await screen.findByText("Start blocked. Resolve every validation error shown below.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add dummy players" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Add dummy players" })[1]);

    expect(await screen.findByText(/8 eligible, checked-in dummy players were added/)).toBeInTheDocument();
    expect(screen.getByText(/8 eligible and checked in/)).toBeInTheDocument();
    expect(screen.getByText(/8 actual participants validated/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add dummy players" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      `/api/v1/admin/tournaments/${competition.tournamentId}/divisions/${competition.divisionId}/test-entrants`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ count: 8 }) }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("blocks ending until all matches are complete", () => {
    render(<AdminCompetitionLifecycle competition={{ ...competition, status: "LIVE", totalMatches: 7, unfinishedMatches: 1 }} />);
    expect(screen.getByRole("button", { name: "End tournament" })).toBeDisabled();
    expect(screen.getByText(/unlocks after all matches are final/)).toBeInTheDocument();
  });
});
