// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManagedGameDirectory } from "./managed-game-directory";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("ManagedGameDirectory", () => {
  it("filters by search, mode, and genre", () => {
    render(<ManagedGameDirectory />);

    const filters = screen.getByLabelText("Game directory filters");
    expect(within(filters).getAllByRole("combobox")).toHaveLength(3);
    expect(within(filters).getByRole("textbox", { name: "Search games" }).closest("label")).toHaveClass("directory-search");

    fireEvent.change(screen.getByRole("textbox", { name: "Search games" }), { target: { value: "Tekken" } });
    expect(screen.getByRole("link", { name: /Tekken 8/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by mode" }), { target: { value: "team" } });
    expect(screen.getByText("No games found")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by mode" }), { target: { value: "individual" } });
    expect(screen.getByRole("link", { name: /Tekken 8/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Search games" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by genre" }), { target: { value: "Battle Royale" } });
    expect(screen.getByRole("link", { name: /PUBG Mobile/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Dota 2/ })).not.toBeInTheDocument();
  });

  it("renders a distinct preview treatment for each seeded game", () => {
    render(<ManagedGameDirectory />);

    expect(screen.getByRole("link", { name: /Dota 2/ })).toHaveClass("game-preview-moba");
    expect(screen.getByRole("link", { name: /VALORANT/ })).toHaveClass("game-preview-tactical");
    expect(screen.getByRole("link", { name: /Tekken 8/ })).toHaveClass("game-preview-fighting");
    expect(screen.getByRole("link", { name: /PUBG Mobile/ })).toHaveClass("game-preview-battle");
  });
});
