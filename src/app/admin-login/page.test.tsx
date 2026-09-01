// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminLoginPage from "./page";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockClear();
  refresh.mockClear();
});

describe("AdminLoginPage", () => {
  it("quickly signs in as the development superadmin without sending credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { user: { role: "super_admin" } } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminLoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Quick sign in as superadmin" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/admin/quick-login", { method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/admin");
    expect(refresh).toHaveBeenCalled();
  });
});
