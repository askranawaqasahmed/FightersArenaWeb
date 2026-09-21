// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventParticipantTable } from "./event-participant-table";
import { type AdminEventCompetition } from "@/lib/admin-events";
import { adminEvents } from "@/lib/admin-events.fixture";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); refresh.mockClear(); });

const tournamentId = "11111111-1111-4111-8111-111111111111";
const registrationId = "22222222-2222-4222-8222-222222222222";

const databaseCompetition: AdminEventCompetition = {
  id: "33333333-3333-4333-8333-333333333333",
  tournamentId,
  name: "Tekken Open",
  gameSlug: "tekken-8",
  game: "Tekken 8",
  type: "tournament",
  status: "REGISTRATION OPEN",
  capacity: 16,
  stages: [],
  participants: [
    { id: "p1", registrationId, handle: "VIPER", name: "Viper Khan", registrationStatus: "pending", paymentStatus: "not_required", accountStatus: "active" },
    { id: "p2", registrationId: "55555555-5555-4555-8555-555555555555", handle: "CIPHER", name: "Cipher Ali", registrationStatus: "confirmed", paymentStatus: "not_required", accountStatus: "active" },
  ],
};

describe("EventParticipantTable", () => {
  it("shows participant, confirmation, and account status", () => {
    render(<EventParticipantTable competition={databaseCompetition} />);
    const viperRow = screen.getByText("VIPER").closest("tr");
    expect(viperRow).not.toBeNull();
    expect(within(viperRow as HTMLElement).getByText("PENDING")).toBeInTheDocument();
    expect(within(viperRow as HTMLElement).getByText("ACTIVE")).toBeInTheDocument();
  });

  it("approves a pending registration through the admin review API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { id: registrationId, status: "confirmed", eligible: true, checkedInAt: "2026-08-21T00:00:00.000Z" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<EventParticipantTable competition={databaseCompetition} />);

    const viperRow = screen.getByText("VIPER").closest("tr");
    fireEvent.click(within(viperRow as HTMLElement).getByRole("button", { name: /Approve/ }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/admin/tournaments/${tournamentId}/divisions/${databaseCompetition.id}/registrations/${registrationId}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "approve" }) }),
    );
  });

  it("offers no review actions for fixture events without database ids", () => {
    render(<EventParticipantTable competition={adminEvents[0].competitions[0]} />);
    expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reject/ })).not.toBeInTheDocument();
  });
});
