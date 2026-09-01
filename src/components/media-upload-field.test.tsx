// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaUploadField } from "./media-upload-field";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("MediaUploadField", () => {
  it("uploads a file through the shared S3 API and returns the object URL", async () => {
    const onUploaded = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: { key: "slider/2026-08-18/id.webp", url: "/api/v1/media/slider/2026-08-18/id.webp", originalName: "hero.webp", mimeType: "image/webp", sizeBytes: 4 },
    }), { status: 201, headers: { "content-type": "application/json" } }));

    render(<MediaUploadField purpose="slider" label="Upload slider image" accept="image/webp" onUploaded={onUploaded} />);
    const file = new File(["hero"], "hero.webp", { type: "image/webp" });
    fireEvent.change(screen.getByLabelText(/Upload slider image/), { target: { files: [file] } });

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(expect.objectContaining({ key: "slider/2026-08-18/id.webp" })));
    expect(fetch).toHaveBeenCalledWith("/api/v1/uploads", expect.objectContaining({ method: "POST" }));
    expect(screen.getByRole("status")).toHaveTextContent("uploaded to object storage");
  });

  it("shows the API error when object storage is not configured", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ detail: "S3 object storage is not configured." }), { status: 503 }));
    render(<MediaUploadField purpose="attachment" label="Add attachment" onUploaded={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Add attachment/), { target: { files: [new File(["x"], "rules.txt", { type: "text/plain" })] } });
    expect(await screen.findByRole("status")).toHaveTextContent("S3 object storage is not configured");
  });
});
