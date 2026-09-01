// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { generateDoubleElimination } from "@/domain/tournament-engine";
import { ConnectedEliminationBracket } from "./connected-elimination-bracket";

afterEach(cleanup);

describe("ConnectedEliminationBracket", () => {
  it("renders every lane and cross-lane connector in one pannable bracket map", () => {
    const participants = Array.from({ length: 8 }, (_, index) => ({
      id: `p-${index + 1}`,
      name: `Seed ${index + 1}`,
      seed: index + 1,
    }));
    const { container } = render(<ConnectedEliminationBracket bracket={generateDoubleElimination(participants, { grandFinalReset: true })} />);

    expect(screen.getByRole("region", { name: "Double-elimination bracket map" })).toBeInTheDocument();
    expect(screen.getByText("Upper bracket")).toBeInTheDocument();
    expect(screen.getByText("Lower bracket")).toBeInTheDocument();
    expect(screen.getByText("Grand final")).toBeInTheDocument();
    expect(screen.getByText("Drag to pan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show details" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Upper champion versus lower champion")).not.toBeInTheDocument();
    expect(screen.queryByText("Loser / drop")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".connected-bracket-scroll")).toHaveLength(1);
    expect(container.querySelectorAll(".bracket-connectors")).toHaveLength(1);
    expect(container.querySelectorAll(".bracket-connectors path").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".connector-winner").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".connector-loser")).toHaveLength(0);
    expect(container.querySelector('path[data-source="U1-M1"][data-target="L1-M1"]')).not.toBeInTheDocument();
    expect(container.querySelector('path[data-source="U3-M1"][data-target="GF1"]')).toBeInTheDocument();
    expect(container.querySelector('path[data-source="L4-M1"][data-target="GF1"]')).toBeInTheDocument();
    const upperHeading = screen.getByText("Upper bracket").closest(".connected-lane-heading") as HTMLElement;
    const lowerHeading = screen.getByText("Lower bracket").closest(".connected-lane-heading") as HTMLElement;
    expect(Number.parseFloat(lowerHeading.style.top) - Number.parseFloat(upperHeading.style.top)).toBe(624);

    const openingMatch = screen.getByLabelText("Upper Quarterfinals, match U1-M1");
    const nextOpeningMatch = screen.getByLabelText("Upper Quarterfinals, match U1-M2");
    const thirdOpeningMatch = screen.getByLabelText("Upper Quarterfinals, match U1-M3");
    const firstLowerMatch = screen.getByLabelText("Lower Round 1, match L1-M1");
    expect(within(openingMatch).getByText("MATCH #1 · U1-M1")).toBeInTheDocument();
    expect(within(thirdOpeningMatch).getByText("MATCH #3 · U1-M3")).toBeInTheDocument();
    expect(within(firstLowerMatch).getByText("MATCH #5 · L1-M1")).toBeInTheDocument();
    const compactTop = Number.parseFloat(openingMatch.style.getPropertyValue("--match-top"));
    const compactNextTop = Number.parseFloat(nextOpeningMatch.style.getPropertyValue("--match-top"));
    const compactHeight = Number.parseFloat(openingMatch.style.getPropertyValue("--match-height"));
    expect(compactNextTop - compactTop - compactHeight).toBe(28);
    expect(within(openingMatch).queryByText(/W → Upper Semifinals · U2-M1/)).not.toBeInTheDocument();
    expect(screen.getByText("Bracket Reset")).toBeInTheDocument();
    expect(screen.getByText("Winner of GF1")).toBeInTheDocument();
    expect(screen.getByText("Loser of GF1")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Grand Final, match GF1")).getByText("MATCH #14 · GF1")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Bracket Reset, match GF2")).getByText("MATCH #15 · GF2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByRole("button", { name: "Hide details" })).toHaveAttribute("aria-expanded", "true");
    const detailedTop = Number.parseFloat(openingMatch.style.getPropertyValue("--match-top"));
    const detailedNextTop = Number.parseFloat(nextOpeningMatch.style.getPropertyValue("--match-top"));
    const detailedHeight = Number.parseFloat(openingMatch.style.getPropertyValue("--match-height"));
    expect(detailedNextTop - detailedTop - detailedHeight).toBe(28);
    expect(screen.getByText("Upper champion versus lower champion")).toBeInTheDocument();
    expect(within(openingMatch).getByText(/W → Upper Semifinals · U2-M1/)).toBeInTheDocument();
    expect(within(openingMatch).getByText(/L → Lower Round 1 · L1-M1/)).toBeInTheDocument();
  });

  it("pans the unified preview with the hand tool", () => {
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    const participants = Array.from({ length: 8 }, (_, index) => ({ id: `p-${index + 1}`, name: `Seed ${index + 1}`, seed: index + 1 }));
    render(<ConnectedEliminationBracket bracket={generateDoubleElimination(participants)} />);
    const viewport = screen.getByRole("region", { name: /Bracket preview/ });
    Object.defineProperty(viewport, "scrollLeft", { configurable: true, writable: true, value: 100 });
    Object.defineProperty(viewport, "scrollTop", { configurable: true, writable: true, value: 80 });

    fireEvent.pointerDown(viewport, { pointerId: 1, button: 0, clientX: 120, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 90, clientY: 70 });
    fireEvent.pointerUp(viewport, { pointerId: 1, clientX: 90, clientY: 70 });

    expect(viewport.scrollLeft).toBe(130);
    expect(viewport.scrollTop).toBe(110);
    expect(viewport).not.toHaveClass("is-dragging");
  });

  it("marks a live match without placing timing information on the bracket card", () => {
    const participants = Array.from({ length: 4 }, (_, index) => ({ id: `p-${index + 1}`, name: `Seed ${index + 1}`, seed: index + 1 }));
    const bracket = generateDoubleElimination(participants);
    const startedAt = new Date(Date.now() - 65_000).toISOString();
    render(<ConnectedEliminationBracket bracket={bracket} matches={[{
      code: "U1-M1",
      matchNumber: 3,
      status: "live",
      startedAt,
      endedAt: null,
      sides: [{ score: 1, outcome: null }, { score: 0, outcome: null }],
    }]} />);

    const liveMatch = screen.getByLabelText("Upper Semifinals, match U1-M1");
    expect(liveMatch).toHaveClass("is-live");
    expect(within(liveMatch).getByLabelText("Live match")).toBeInTheDocument();
    expect(within(liveMatch).getByText("LIVE")).toBeInTheDocument();
    expect(within(liveMatch).getByText("MATCH #3 · U1-M1")).toBeInTheDocument();
    expect([...liveMatch.querySelectorAll(".match-score")].map((score) => score.textContent)).toEqual(["1", "0"]);
    expect(within(liveMatch).queryByText(/01:0\d/)).not.toBeInTheDocument();
  });

  it("hides placeholder zero seeds while retaining real seed numbers", () => {
    const bracket = generateDoubleElimination([
      { id: "p-1", name: "Unseeded Player", seed: 1 },
      { id: "p-2", name: "Seeded Player", seed: 2 },
      { id: "p-3", name: "Player 3", seed: 3 },
      { id: "p-4", name: "Player 4", seed: 4 },
    ]);
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        for (const slot of match.slots) {
          if (slot.type === "participant" && slot.participant.id === "p-1") slot.participant.seed = 0;
        }
      }
    }
    render(<ConnectedEliminationBracket bracket={bracket} />);

    expect(screen.getByText("Unseeded Player")).toBeInTheDocument();
    expect(screen.queryByText("#0 Unseeded Player")).not.toBeInTheDocument();
    expect(screen.getByText("#2 Seeded Player")).toBeInTheDocument();
  });
});
