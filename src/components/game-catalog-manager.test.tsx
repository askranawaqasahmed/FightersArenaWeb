// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameCatalogManager, type AdminGame } from "./game-catalog-manager";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const games: AdminGame[] = [
  { id: "g1", slug: "kof-2002", name: "The King of Fighters 2002", genre: "Fighting", publisher: "SNK", teamSize: 1, coverGradient: "pink", imageUrl: null, players: 2, active: true },
  { id: "g2", slug: "street-fighter-6", name: "Street Fighter 6", genre: "Fighting", publisher: "Capcom", teamSize: 1, coverGradient: "blue", imageUrl: null, players: 1, active: true },
  { id: "g3", slug: "retired-game", name: "Retired Game", genre: "Racing", publisher: null, teamSize: 4, coverGradient: "green", imageUrl: null, players: 0, active: false },
];

beforeEach(() => { refresh.mockClear(); vi.spyOn(window, "confirm").mockReturnValue(true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("GameCatalogManager", () => {
  it("creates a game through the admin API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { game: { id: "new" } } }), {
      status: 201, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GameCatalogManager games={games} />);
    fireEvent.click(screen.getByRole("button", { name: "Add game" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Game name" }), { target: { value: "Fatal Fury: City of the Wolves" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Genre" }), { target: { value: "Fighting" } });
    fireEvent.click(screen.getByRole("button", { name: "Save game" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admin/games");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ name: "Fatal Fury: City of the Wolves", genre: "Fighting" });
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("edits an existing game against its id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { games: [] } }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GameCatalogManager games={games} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Street Fighter 6" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Publisher" }), { target: { value: "Capcom Co., Ltd." } });
    fireEvent.click(screen.getByRole("button", { name: "Save game" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/admin/games/g2");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ publisher: "Capcom Co., Ltd." });
  });

  it("hides a game instead of deleting it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { games: [] } }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<GameCatalogManager games={games} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide Street Fighter 6" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ active: false });
  });

  it("filters the catalog and exposes working view links", () => {
    render(<GameCatalogManager games={games} />);
    expect(screen.getByRole("textbox", { name: "Search games" }).closest("label")).toHaveClass("directory-search");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by genre" }), { target: { value: "Racing" } });
    expect(screen.getByText("Retired Game")).toBeInTheDocument();
    expect(screen.queryByText("Street Fighter 6")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Retired Game" })).toHaveAttribute("href", "/games/retired-game");
  });
});
