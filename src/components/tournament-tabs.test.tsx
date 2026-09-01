// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TournamentTabs } from "./tournament-tabs";

afterEach(cleanup);

describe("TournamentTabs", () => {
  it("switches between bracket, groups, and matches panels", () => {
    render(<TournamentTabs format="Groups → Double Elimination" progress={64} />);

    expect(screen.getByRole("tab", { name: "Bracket" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Championship bracket" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Groups" }));
    expect(screen.getByRole("tab", { name: "Groups" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Group standings" })).toBeInTheDocument();
    expect(screen.getByText("Team Cipher")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Matches" }));
    expect(screen.getByRole("tab", { name: "Matches" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Schedule and results" })).toBeInTheDocument();
    expect(screen.getByText("Riftwalkers vs Orbit")).toBeInTheDocument();
  });
});
