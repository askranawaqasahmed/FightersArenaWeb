// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameCatalogManager, gameCatalogStorageKey } from "./game-catalog-manager";

beforeEach(() => { window.localStorage.clear(); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("GameCatalogManager", () => {
  it("creates, edits, and deletes a game", () => {
    render(<GameCatalogManager />);
    fireEvent.click(screen.getByRole("button", { name: "Add game" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Game name" }), { target: { value: "Rocket League" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), { target: { value: "Sports" } });
    fireEvent.click(screen.getByRole("button", { name: "Save game" }));
    expect(screen.getByText("Rocket League")).toBeInTheDocument();

    const row = screen.getByText("Rocket League").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit Rocket League" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), { target: { value: "Racing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save game" }));
    expect(screen.getByText("Rocket League").closest("tr")).toHaveTextContent("Racing");

    fireEvent.click(screen.getByRole("button", { name: "Delete Rocket League" }));
    expect(screen.queryByText("Rocket League")).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(gameCatalogStorageKey) ?? "[]")).not.toEqual(expect.arrayContaining([expect.objectContaining({ slug: "rocket-league" })]));
  });

  it("filters the catalog and exposes working view links", () => {
    render(<GameCatalogManager />);
    expect(screen.getAllByRole("combobox", { name: /Filter by/ })).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Search game catalog" }).closest("label")).toHaveClass("directory-search");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by genre" }), { target: { value: "Fighting" } });
    expect(screen.getByText("Tekken 8")).toBeInTheDocument();
    expect(screen.queryByText("Dota 2")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Tekken 8" })).toHaveAttribute("href", "/games/tekken-8");
  });
});
