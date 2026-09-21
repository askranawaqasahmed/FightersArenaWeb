// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ManagedGameDirectory } from "./managed-game-directory";
import type { PublicGame } from "@/lib/game-data";

const games: PublicGame[] = [
  { id: "g1", slug: "kof-2002", name: "The King of Fighters 2002", genre: "Fighting", publisher: "SNK", teamSize: 1, coverGradient: "pink", imageUrl: null, players: 2 },
  { id: "g2", slug: "street-fighter-6", name: "Street Fighter 6", genre: "Fighting", publisher: "Capcom", teamSize: 1, coverGradient: "blue", imageUrl: null, players: 1 },
  { id: "g3", slug: "squad-shooter", name: "Squad Shooter", genre: "Tactical FPS", publisher: "Example", teamSize: 5, coverGradient: "green", imageUrl: null, players: 0 },
];

afterEach(cleanup);

describe("ManagedGameDirectory", () => {
  it("filters by search, mode, and genre", () => {
    render(<ManagedGameDirectory games={games} />);

    const filters = screen.getByLabelText("Game directory filters");
    expect(within(filters).getAllByRole("combobox")).toHaveLength(3);
    expect(within(filters).getByRole("textbox", { name: "Search games" }).closest("label")).toHaveClass("directory-search");

    fireEvent.change(screen.getByRole("textbox", { name: "Search games" }), { target: { value: "King of Fighters" } });
    expect(screen.getByRole("link", { name: /King of Fighters 2002/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by mode" }), { target: { value: "team" } });
    expect(screen.getByText("No games found")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by mode" }), { target: { value: "individual" } });
    expect(screen.getByRole("link", { name: /King of Fighters 2002/ })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search games" }), { target: { value: "" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by mode" }), { target: { value: "all" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter games by genre" }), { target: { value: "Tactical FPS" } });
    expect(screen.getByRole("link", { name: /Squad Shooter/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Street Fighter 6/ })).not.toBeInTheDocument();
  });

  it("picks a preview treatment from the genre", () => {
    render(<ManagedGameDirectory games={games} />);

    expect(screen.getByRole("link", { name: /King of Fighters 2002/ })).toHaveClass("game-preview-fighting");
    expect(screen.getByRole("link", { name: /Squad Shooter/ })).toHaveClass("game-preview-tactical");
  });

  it("shows the registered player count", () => {
    render(<ManagedGameDirectory games={games} />);

    expect(screen.getByRole("link", { name: /King of Fighters 2002/ })).toHaveTextContent("2 players");
    expect(screen.getByRole("link", { name: /Street Fighter 6/ })).toHaveTextContent("1 player");
    expect(screen.getByRole("link", { name: /Squad Shooter/ })).toHaveTextContent("Team competition");
  });
});
