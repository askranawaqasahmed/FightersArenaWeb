// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdminTournamentRows } from "./admin-tournament-rows";
import { adminEvents } from "@/lib/admin-events";
import { createGameCompetition, createStage, tournamentDraftStorageKey } from "@/lib/tournament-draft";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("AdminTournamentRows", () => {
  it("links each event to details and editing", () => {
    render(<table><tbody><AdminTournamentRows initialEvents={adminEvents} /></tbody></table>);
    expect(screen.getByRole("link", { name: "View National Esports Championship 2026" })).toHaveAttribute("href", "/admin/tournaments/national-esports-championship-2026");
    expect(screen.getByRole("link", { name: "Edit National Esports Championship 2026" })).toHaveAttribute("href", "/admin/tournaments/national-esports-championship-2026/edit");
  });

  it("shows locally saved multi-game event drafts", () => {
    window.localStorage.setItem(tournamentDraftStorageKey, JSON.stringify({
      "draft-event": {
        slug: "draft-event",
        name: "Draft Event",
        description: "Two games",
        competitions: [
          createGameCompetition("competition-1", { gameSlug: "valorant", competitionType: "tournament" }),
          createGameCompetition("competition-2", { gameSlug: "tekken-8", competitionType: "league", stages: [createStage("stage-2", "double-elimination")] }),
        ],
      },
    }));

    render(<table><tbody><AdminTournamentRows initialEvents={adminEvents} /></tbody></table>);
    const draftRow = screen.getByText("Draft Event").closest("tr");
    expect(draftRow).not.toBeNull();
    expect(within(draftRow as HTMLElement).getByText("1 tournament · 1 league")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Draft Event" })).toHaveAttribute("href", "/admin/tournaments/draft-event");
  });

  it("pins live events first and orders each group newest first", () => {
    const baseEvent = adminEvents[0];
    const events = [
      { ...baseEvent, slug: "older-draft", name: "Older Draft", status: "DRAFT" as const, createdAt: "2026-01-01T00:00:00.000Z" },
      { ...baseEvent, slug: "older-live", name: "Older Live", status: "LIVE" as const, createdAt: "2026-02-01T00:00:00.000Z" },
      { ...baseEvent, slug: "newest-draft", name: "Newest Draft", status: "DRAFT" as const, createdAt: "2026-04-01T00:00:00.000Z" },
      { ...baseEvent, slug: "newer-live", name: "Newer Live", status: "LIVE" as const, createdAt: "2026-03-01T00:00:00.000Z" },
    ];

    render(<table><tbody><AdminTournamentRows initialEvents={events} /></tbody></table>);

    const eventNames = screen.getAllByRole("row").map((row) => within(row).getAllByRole("cell")[0].textContent);
    expect(eventNames).toEqual([
      expect.stringContaining("Newer Live"),
      expect.stringContaining("Older Live"),
      expect.stringContaining("Newest Draft"),
      expect.stringContaining("Older Draft"),
    ]);
  });
});
