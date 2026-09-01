// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GamerDirectory } from "./gamer-directory";
import type { PublicGamerSummary } from "@/lib/public-gamer-data";

afterEach(cleanup);

const gamers: PublicGamerSummary[] = [
  { slug: "nova", handle: "NOVA", name: "Ayaan Khan", initials: "AK", city: "Karachi", country: "Pakistan", countryIso2: "PK", game: "Dota 2", points: 9820, rank: 1, verified: true, avatarUrl: null },
  { slug: "viper", handle: "VIPER", name: "Bilal Ahmed", initials: "BA", city: "Lahore", country: "Pakistan", countryIso2: "PK", game: "Tekken 8", points: 8100, rank: 2, verified: true, avatarUrl: null },
  { slug: "frost", handle: "FROST", name: "Omar Farooq", initials: "OF", city: "Lahore", country: "Pakistan", countryIso2: "PK", game: "Tekken 8", points: 4400, rank: 3, verified: false, avatarUrl: null },
];

describe("GamerDirectory", () => {
  it("uses a full-row search and three working dropdown filters", () => {
    render(<GamerDirectory gamers={gamers} />);

    const filters = screen.getByLabelText("Gamer ranking filters");
    expect(within(filters).getAllByRole("combobox")).toHaveLength(3);
    expect(within(filters).getByRole("textbox", { name: "Search gamers" }).closest("label")).toHaveClass("directory-search");
    fireEvent.change(screen.getByRole("combobox", { name: "Filter rankings by city" }), { target: { value: "Lahore" } });
    expect(screen.getByRole("link", { name: /VIPER/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /NOVA/ })).not.toBeInTheDocument();
  });

  it("filters by game and by verification state", () => {
    render(<GamerDirectory gamers={gamers} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Filter rankings by game" }), { target: { value: "Dota 2" } });
    expect(screen.getByRole("link", { name: /NOVA/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /VIPER/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter rankings by game" }), { target: { value: "all" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter rankings by verification" }), { target: { value: "unverified" } });
    expect(screen.getByRole("link", { name: /FROST/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /NOVA/ })).not.toBeInTheDocument();
  });

  it("searches by player name as well as handle", () => {
    render(<GamerDirectory gamers={gamers} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search gamers" }), { target: { value: "Ayaan" } });
    expect(screen.getByRole("link", { name: /NOVA/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /FROST/ })).not.toBeInTheDocument();
  });

  it("explains an empty roster instead of rendering empty filters", () => {
    render(<GamerDirectory gamers={[]} />);
    expect(screen.getByText("No public player profiles yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gamer ranking filters")).not.toBeInTheDocument();
  });
});
