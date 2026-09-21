// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGamerDetail, type AdminGamerDetailData } from "./admin-gamer-detail";
import { AdminGamerDirectory } from "./admin-gamer-directory";
import { AdminGamerEditor, type AdminGamerEditorData } from "./admin-gamer-editor";
import type { AdminGamerListItem } from "@/lib/admin-gamer-data";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));

const gamers: AdminGamerListItem[] = [
  {
    slug: "hazz", displayName: "Hazz", handle: "Hazz", email: "hazz@fightersarena.com", phone: "+923431263350",
    city: "Karachi", game: "Fatal Fury: City of the Wolves", points: 0, verificationStatus: "verified", accountStatus: "active",
  },
  {
    slug: "kashif-yagami", displayName: "Kashif Yagami", handle: "Kashif Yagami", email: "kashif@fightersarena.com",
    phone: "+923212281481", city: "Lahore", game: "Street Fighter V", points: 0, verificationStatus: "verified", accountStatus: "active",
  },
];

const detail: AdminGamerDetailData = {
  slug: "hazz", displayName: "Hazz", handle: "Hazz", bio: null,
  email: "hazz@fightersarena.com", phone: "+923431263350", city: "Karachi", country: "Pakistan",
  rankingPoints: 0, verificationStatus: "verified", accountStatus: "active",
  games: [{ gameId: "game-1", game: "Fatal Fury: City of the Wolves", inGameName: "Hazz", verified: true }],
  achievements: [{ id: "a1", category: "milestone", title: "Undefeated KOF 2002 run", detail: null, yearLabel: "2014–2019" }],
  placements: [
    { tournamentName: "Takedown 2025", gameName: "Fatal Fury: City of the Wolves", year: 2025, finalRank: 1, placementLabel: null },
    { tournamentName: "Takedown 2026", gameName: "Fatal Fury: City of the Wolves", year: 2026, finalRank: 2, placementLabel: null },
  ],
};

const editable: AdminGamerEditorData = {
  slug: "hazz", displayName: "Hazz", handle: "Hazz", bio: null, cityId: null,
  profileVisibility: "public", verificationStatus: "verified", rankingPoints: 0,
  games: [{ gameId: "game-1", inGameName: "Hazz" }],
  achievements: [],
};

beforeEach(() => { replace.mockClear(); refresh.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("admin gamers", () => {
  it("filters gamer rows and provides working detail/edit links", () => {
    render(<AdminGamerDirectory gamers={gamers} />);

    const filters = screen.getByLabelText("Gamer directory filters");
    expect(within(filters).getAllByRole("combobox")).toHaveLength(3);
    expect(within(filters).getByRole("textbox", { name: "Search gamers" }).closest("label")).toHaveClass("directory-search");

    fireEvent.change(screen.getByRole("combobox", { name: "Filter gamers by game" }), { target: { value: "Street Fighter V" } });
    expect(screen.queryByRole("link", { name: "View Hazz" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Kashif Yagami" })).toHaveAttribute("href", "/admin/gamers/kashif-yagami");
    expect(screen.getByRole("link", { name: "Edit Kashif Yagami" })).toHaveAttribute("href", "/admin/gamers/kashif-yagami/edit");
  });

  it("searches by the sign-in email", () => {
    render(<AdminGamerDirectory gamers={gamers} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search gamers" }), { target: { value: "kashif@" } });
    expect(screen.getByRole("link", { name: "View Kashif Yagami" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View Hazz" })).not.toBeInTheDocument();
  });

  it("shows recorded results using the Champion wording", () => {
    render(<AdminGamerDetail gamer={detail} />);

    expect(screen.getByRole("heading", { name: /Tournament results/ })).toBeInTheDocument();
    expect(screen.getByText("Champion")).toBeInTheDocument();
    expect(screen.getByText("Runner-up")).toBeInTheDocument();
    expect(screen.queryByText("1st")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit gamer/ })).toHaveAttribute("href", "/admin/gamers/hazz/edit");
  });

  it("blocks a gamer and revokes active sessions", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      slug: "hazz",
      status: "suspended",
      revokedSessions: 2,
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminGamerDetail gamer={detail} />);

    fireEvent.click(screen.getByRole("button", { name: "Block gamer" }));

    expect(await screen.findByText(/Hazz is blocked and all active sessions were revoked/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/gamers/hazz/status", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ status: "suspended" }),
    }));
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unblock gamer" })).toBeEnabled();
    expect(refresh).toHaveBeenCalled();
  });

  it("saves an edited gamer to the database and returns to the detail route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { gamer: {} } }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminGamerEditor gamer={editable} gameOptions={[{ id: "game-1", name: "Fatal Fury: City of the Wolves" }]} cityOptions={[{ id: "city-1", name: "Karachi" }]} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Display name" }), { target: { value: "Hassan" } });
    fireEvent.click(screen.getByRole("button", { name: "Save gamer" }));

    expect(await vi.waitFor(() => fetchMock.mock.calls[0][0])).toBe("/api/v1/admin/gamers/hazz");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ displayName: "Hassan", handle: "Hazz" });
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/gamers/hazz"));
  });
});
