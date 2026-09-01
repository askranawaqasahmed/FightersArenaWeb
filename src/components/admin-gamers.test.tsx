// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminGamerDetail } from "./admin-gamer-detail";
import { AdminGamerDirectory } from "./admin-gamer-directory";
import { AdminGamerEditor } from "./admin-gamer-editor";
import { gamerDirectoryStorageKey } from "./managed-gamers";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

beforeEach(() => { window.localStorage.clear(); replace.mockClear(); refresh.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("admin gamers", () => {
  it("filters gamer rows and provides working detail/edit links", () => {
    render(<AdminGamerDirectory />);

    const filters = screen.getByLabelText("Gamer directory filters");
    expect(within(filters).getAllByRole("combobox")).toHaveLength(3);
    expect(within(filters).getByRole("textbox", { name: "Search gamers" }).closest("label")).toHaveClass("directory-search");

    fireEvent.change(screen.getByRole("combobox", { name: "Filter gamers by game" }), { target: { value: "Dota 2" } });
    expect(screen.getByText("NOVA")).toBeInTheDocument();
    expect(screen.queryByText("VIPER")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View NOVA" })).toHaveAttribute("href", "/admin/gamers/nova");
    expect(screen.getByRole("link", { name: "Edit NOVA" })).toHaveAttribute("href", "/admin/gamers/nova/edit");
  });

  it("shows match results under player history", () => {
    render(<AdminGamerDetail slug="nova" />);

    expect(screen.getByRole("heading", { name: /Player history/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Opponent" })).toBeInTheDocument();
    expect(screen.getByText("VOLT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit gamer/ })).toHaveAttribute("href", "/admin/gamers/nova/edit");
  });

  it("blocks a database-backed gamer and revokes active sessions", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      slug: "nova",
      status: "suspended",
      revokedSessions: 2,
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminGamerDetail slug="nova" initialAccountStatus="active" />);

    fireEvent.click(screen.getByRole("button", { name: "Block gamer" }));

    expect(await screen.findByText(/NOVA is blocked and all active sessions were revoked/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/admin/gamers/nova/status", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ status: "suspended" }),
    }));
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unblock gamer" })).toBeEnabled();
    expect(refresh).toHaveBeenCalled();
  });

  it("edits a gamer and returns to the detail route", () => {
    render(<AdminGamerEditor slug="nova" />);

    fireEvent.change(screen.getByRole("textbox", { name: "Full name" }), { target: { value: "Areeb Ahmed Khan" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Primary game" }), { target: { value: "VALORANT" } });
    fireEvent.click(screen.getByRole("button", { name: "Save gamer" }));

    const stored = JSON.parse(window.localStorage.getItem(gamerDirectoryStorageKey) ?? "[]");
    expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ slug: "nova", name: "Areeb Ahmed Khan", game: "VALORANT" })]));
    expect(replace).toHaveBeenCalledWith("/admin/gamers/nova");
  });
});
