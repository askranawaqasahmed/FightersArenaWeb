// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventImageGallery, hasEventEnded } from "./event-image-gallery";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); refresh.mockClear(); });

const tournamentId = "11111111-1111-4111-8111-111111111111";

describe("EventImageGallery", () => {
  it("keeps the uploader locked until an event has ended", () => {
    render(<EventImageGallery eventSlug="future-event" eventName="Future Event" endsAt="2999-01-01" status="READY" tournamentId={tournamentId} />);

    expect(screen.getByText("Uploader opens after the event ends")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Upload event image/)).not.toBeInTheDocument();
  });

  it("uploads and links a described image to the event gallery through the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (String(input) === "/api/v1/uploads") {
        return Promise.resolve(new Response(JSON.stringify({
          data: { key: "event-gallery/2026-08-19/id.webp", url: "/api/v1/media/event-gallery/2026-08-19/id.webp", originalName: "winners.webp", mimeType: "image/webp", sizeBytes: 7 },
        }), { status: 201, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        data: { image: { id: "33333333-3333-4333-8333-333333333333", url: "/api/v1/media/event-gallery/2026-08-19/id.webp", caption: "The winning team lifting the trophy", sequence: 0, uploadedAt: "2026-08-20T00:00:00.000Z" } },
      }), { status: 201, headers: { "content-type": "application/json" } }));
    });
    render(<EventImageGallery eventSlug="completed-event" eventName="Completed Event" endsAt="2999-01-01" status="COMPLETED" tournamentId={tournamentId} />);

    const uploadInput = screen.getByLabelText(/Upload event image/);
    expect(uploadInput).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Image description" }), { target: { value: "The winning team lifting the trophy" } });
    expect(uploadInput).toBeEnabled();
    fireEvent.change(uploadInput, { target: { files: [new File(["winners"], "winners.webp", { type: "image/webp" })] } });

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const linkCall = fetchMock.mock.calls.find(([input]) => String(input) === `/api/v1/admin/tournaments/${tournamentId}/gallery`);
    expect(linkCall).toBeDefined();
    expect(JSON.parse(String(linkCall?.[1]?.body))).toEqual({ key: "event-gallery/2026-08-19/id.webp", caption: "The winning team lifting the trophy" });
  });

  it("renders server-provided gallery images and removes one through the API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<EventImageGallery eventSlug="completed-event" eventName="Completed Event" endsAt="2020-01-01" status="COMPLETED" tournamentId={tournamentId} initialImages={[{
      id: "44444444-4444-4444-8444-444444444444",
      key: "event-gallery/2026-08-19/photo.webp",
      url: "/api/v1/media/event-gallery/2026-08-19/photo.webp",
      name: "Trophy lift",
      altText: "The winners on stage",
      mimeType: "image/webp",
      sizeBytes: 7,
      uploadedAt: "2026-08-20T00:00:00.000Z",
    }]} />);

    expect(screen.getByRole("img", { name: "The winners on stage" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Trophy lift" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(`/api/v1/admin/tournaments/${tournamentId}/gallery/44444444-4444-4444-8444-444444444444`, { method: "DELETE" });
  });

  it("opens on the day after the configured end date", () => {
    expect(hasEventEnded("2026-08-19", "LIVE", new Date(2026, 7, 19, 23, 59))).toBe(false);
    expect(hasEventEnded("2026-08-19", "LIVE", new Date(2026, 7, 20, 0, 1))).toBe(true);
  });
});
