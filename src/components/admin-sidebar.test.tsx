// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminSidebar } from "./admin-sidebar";

let pathname = "/admin";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

afterEach(cleanup);

describe("AdminSidebar", () => {
  it("highlights only the link for the current admin page", () => {
    pathname = "/admin/gamers";
    render(<AdminSidebar role="admin" />);

    expect(screen.getByRole("link", { name: "Gamers" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveClass("active");
  });

  it("keeps the parent link active on nested pages", () => {
    pathname = "/admin/tournaments/new";
    render(<AdminSidebar role="super_admin" />);

    expect(screen.getByRole("link", { name: "Events" })).toHaveClass("active");
    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Admin users" })).not.toHaveClass("active");
  });

  it("highlights the super-admin users link", () => {
    pathname = "/admin/users";
    render(<AdminSidebar role="super_admin" />);

    expect(screen.getByRole("link", { name: "Admin users" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveClass("active");
  });

  it("removes match navigation and collapses to an icon rail", () => {
    render(<AdminSidebar role="admin" />);

    expect(screen.queryByRole("link", { name: "Matches" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("complementary")).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  });
});
