// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContentStudio, contentStudioStorageKey } from "./content-studio";
import { HomepageHero, PublishedContentSection } from "./homepage-managed-content";

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { slides: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ContentStudio", () => {
  it("keeps new content in draft until it is published", () => {
    render(<ContentStudio />);
    fireEvent.click(screen.getByRole("button", { name: "New article" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Season Update" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Body" }), { target: { value: "Registration opens this week." } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    const draftItem = screen.getByText("Season Update").closest(".content-list-item") as HTMLElement;
    expect(within(draftItem).getByText("DRAFT")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(contentStudioStorageKey) ?? "{}").articles).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Season Update", status: "draft" })]));
    cleanup();
    render(<PublishedContentSection />);
    expect(screen.queryByText("Season Update")).not.toBeInTheDocument();
    cleanup();
    render(<ContentStudio />);
    const persistedDraftItem = screen.getByText("Season Update").closest(".content-list-item") as HTMLElement;
    fireEvent.click(within(persistedDraftItem).getByRole("button", { name: "Publish" }));
    cleanup();
    render(<PublishedContentSection />);
    expect(screen.getByText("Season Update")).toBeInTheDocument();
  });

  it("publishes a portal-managed homepage slider image through the API", async () => {
    const apiSlide = { id: "slide-1", eyebrow: "", title: "League registrations", summary: "", imageUrl: "/images/arena-hero.png", imageAlt: "Players entering the arena", ctaLabel: "Explore events", ctaUrl: "/tournaments", sequence: 1, published: true };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (String(input) === "/api/v1/admin/content/slides" && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ data: { slide: apiSlide } }), { status: 201, headers: { "content-type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: { slides: [apiSlide] } }), { status: 200, headers: { "content-type": "application/json" } }));
    });

    render(<ContentStudio />);
    fireEvent.click(screen.getByRole("button", { name: "Add slider image" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Slide title" }), { target: { value: "League registrations" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Or image URL" }), { target: { value: "/images/arena-hero.png" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Image alt text" }), { target: { value: "Players entering the arena" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish slide" }));

    await waitFor(() => {
      const createCall = fetchMock.mock.calls.find(([input, init]) => String(input) === "/api/v1/admin/content/slides" && init?.method === "POST");
      expect(createCall).toBeDefined();
      expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(expect.objectContaining({ title: "League registrations", published: true, imageAlt: "Players entering the arena" }));
    });
    cleanup();

    render(<HomepageHero />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "League registrations" })).toBeInTheDocument());
  });
});
