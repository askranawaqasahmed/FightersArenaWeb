// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TournamentBuilder } from "./tournament-builder";
import { createGameCompetition, createStage, defaultTournamentDraft, tournamentDraftStorageKey } from "@/lib/tournament-draft";

const replace = vi.fn();
const refresh = vi.fn();
const scrollIntoView = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  window.localStorage.clear();
  replace.mockClear();
  refresh.mockClear();
  scrollIntoView.mockClear();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  // The builder also loads the game catalogue on mount, so answer per route.
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    if (String(url).startsWith("/api/v1/games")) {
      return Promise.resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ data: { tournamentId: "11111111-1111-4111-8111-111111111111", slug: "summer-arena", lifecycleCompetitions: [{
      tournamentId: "11111111-1111-4111-8111-111111111111",
      divisionId: "22222222-2222-4222-8222-222222222222",
      name: "Dota 2 Open",
      game: "Dota 2",
      status: "DRAFT",
      actualParticipants: 0,
      totalMatches: 0,
      unfinishedMatches: 0,
    }] } }), { status: 200 }));
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TournamentBuilder", () => {
  it("saves the complete tournament draft to PostgreSQL and opens its edit URL", async () => {
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} />);

    expect(screen.getByRole("region", { name: "Event structure preview" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Event name" }), {
      target: { value: "Summer Arena" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Event draft saved successfully to PostgreSQL");
    expect(screen.getByRole("region", { name: "Event structure preview" })).toBeInTheDocument();
    const drafts = JSON.parse(window.localStorage.getItem(tournamentDraftStorageKey) ?? "{}");
    expect(drafts["summer-arena"]).toMatchObject({ name: "Summer Arena", competitions: [{ stages: [{ format: "groups" }] }] });
    expect(fetch).toHaveBeenCalledWith("/api/v1/admin/tournaments/draft", expect.objectContaining({ method: "PUT" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/tournaments/summer-arena/edit"));
  });

  it("loads a previously saved draft when editing", () => {
    window.localStorage.setItem(tournamentDraftStorageKey, JSON.stringify({
      "saved-cup": { ...defaultTournamentDraft, slug: "saved-cup", name: "Saved Cup" },
    }));

    render(<TournamentBuilder initialDraft={defaultTournamentDraft} originalSlug="saved-cup" />);

    expect(screen.getByRole("textbox", { name: "Event name" })).toHaveValue("Saved Cup");
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Event structure preview" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("event-editor-full");
    expect(screen.getByRole("button", { name: "Save draft to enable" })).toBeEnabled();
    expect(screen.getByText(/browser-only draft/i)).toBeInTheDocument();
  });

  it("shows the actual database start control in the saved-event editor", () => {
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} originalSlug="saved-cup" lifecycleCompetitions={[{
      tournamentId: "11111111-1111-4111-8111-111111111111",
      divisionId: "22222222-2222-4222-8222-222222222222",
      name: "Dota 2 Open",
      game: "Dota 2",
      status: "READY",
      actualParticipants: 8,
      totalMatches: 0,
      unfinishedMatches: 0,
    }]} />);

    expect(screen.getByRole("link", { name: "Start tournament" })).toHaveAttribute("href", "#tournament-controls");
    expect(screen.getByRole("button", { name: "Start tournament" })).toBeEnabled();
    expect(screen.getByText(/8 eligible and checked in/)).toBeInTheDocument();
  });

  it("generates a bracket preview from the selected stage format", () => {
    const eliminationDraft = {
      ...defaultTournamentDraft,
      competitions: [createGameCompetition("competition-1", { stages: [createStage("stage-1", "single-elimination")] })],
    };
    render(<TournamentBuilder initialDraft={eliminationDraft} />);

    expect(screen.getByRole("region", { name: "Event structure preview" })).toBeInTheDocument();
    expect(screen.getByLabelText("Single elimination bracket preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Quarterfinals")).toBeInTheDocument();
    expect(screen.getByText("#1 Seed 1")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("generates editable preview seeds without treating them as live signups", () => {
    const eliminationDraft = {
      ...defaultTournamentDraft,
      competitions: [createGameCompetition("competition-1", { stages: [createStage("stage-1", "single-elimination")] })],
    };
    render(<TournamentBuilder initialDraft={eliminationDraft} />);

    expect(screen.getByText(/live tournament, seeds will be populated from confirmed signups/i)).toBeInTheDocument();
    expect(screen.getByText("#1 Seed 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate dummy players" }));

    expect(screen.getByRole("textbox", { name: "Preview name for seed 1" })).toHaveValue("Ayaan Nova Khan");
    expect(screen.getByText("#1 Ayaan Nova Khan")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Preview name for seed 1" }), { target: { value: "Waqas Challenger" } });
    expect(screen.getByText("#1 Waqas Challenger")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate players" })).toBeInTheDocument();
  });

  it("configures an admin-assigned league with leaders and player confirmations", () => {
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Competition type" }), { target: { value: "league" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of teams" }), { target: { value: "2" } });

    expect(screen.getByText("League team assignments")).toBeInTheDocument();
    expect(screen.getAllByText("CONFIGURATION PENDING")).toHaveLength(2);
    const firstTeam = screen.getByText("TEAM 1").closest(".league-team-card");
    expect(firstTeam).not.toBeNull();
    fireEvent.change(within(firstTeam as HTMLElement).getByRole("combobox", { name: "Team leader" }), { target: { value: "nova" } });
    expect(within(firstTeam as HTMLElement).getByRole("checkbox", { name: /NOVA.*Ayaan Khan.*Leader/ })).toBeChecked();
    expect(within(firstTeam as HTMLElement).getByText("Assigned players (1/5)")).toBeInTheDocument();
    expect(screen.getAllByText("CONFIGURATION PENDING")).toHaveLength(2);
  });

  it("adds multiple game competitions under one event", () => {
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} />);
    fireEvent.click(screen.getByRole("button", { name: "Add game competition" }));
    expect(screen.getByText("GAME COMPETITION 2")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox", { name: "Game" })[1]).toHaveValue("valorant");
  });

  it("keeps registration unrestricted unless an admin enables a slot limit", () => {
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} />);
    const restriction = screen.getByRole("checkbox", { name: "Restrict registration slots" });
    expect(restriction).not.toBeChecked();
    expect(screen.queryByRole("spinbutton", { name: "Registration slot limit" })).not.toBeInTheDocument();

    fireEvent.click(restriction);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Registration slot limit" }), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    const drafts = JSON.parse(window.localStorage.getItem(tournamentDraftStorageKey) ?? "{}");
    expect(drafts[defaultTournamentDraft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")].competitions[0])
      .toMatchObject({ registrationRestricted: true, registrationLimit: 32 });
  });

  it("offers active games from the database catalog", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: "g1", slug: "rocket-league", name: "Rocket League", genre: "Sports", publisher: null, teamSize: 3, imageUrl: null }],
    }), { status: 200, headers: { "content-type": "application/json" } })));
    render(<TournamentBuilder initialDraft={defaultTournamentDraft} />);
    expect(await screen.findByRole("option", { name: "Rocket League · Sports" })).toBeInTheDocument();
  });
});
