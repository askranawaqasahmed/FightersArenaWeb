// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomepageHero, SLIDE_INTERVAL_MS } from "./homepage-hero";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { slides: [] } }))));
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function mount() { await act(async () => { render(<HomepageHero />); }); }
const title = () => screen.getByRole("heading", { level: 1 });

describe("Arena slider", () => {
  it("wraps in both directions and supports direct and keyboard navigation", async () => {
    await mount();
    expect(title()).toHaveTextContent("Great players.");
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(title()).toHaveTextContent("Every rivalry");
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(title()).toHaveTextContent("Great players.");
    fireEvent.click(screen.getByRole("button", { name: /Show slide 2/ }));
    expect(title()).toHaveTextContent("A new generation.");
    fireEvent.keyDown(screen.getByRole("button", { name: "Next slide" }), { key: "ArrowRight" });
    expect(title()).toHaveTextContent("Every rivalry");
  });
  it("autoplays but stops while paused or hovered", async () => {
    await mount();
    act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(title()).toHaveTextContent("A new generation.");
    fireEvent.click(screen.getByRole("button", { name: "Pause slideshow" }));
    act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(title()).toHaveTextContent("A new generation.");
    fireEvent.click(screen.getByRole("button", { name: "Play slideshow" }));
    fireEvent.mouseEnter(screen.getByRole("region", { name: "Arena highlights" }));
    act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(title()).toHaveTextContent("A new generation.");
    fireEvent.mouseLeave(screen.getByRole("region", { name: "Arena highlights" }));
    act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS));
    expect(title()).toHaveTextContent("Every rivalry");
  });
  it("respects reduced motion and supports swipe navigation", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    await mount();
    act(() => vi.advanceTimersByTime(SLIDE_INTERVAL_MS * 2));
    expect(title()).toHaveTextContent("Great players.");
    expect(screen.queryByRole("button", { name: "Pause slideshow" })).not.toBeInTheDocument();
    const carousel = screen.getByRole("region", { name: "Arena highlights" });
    fireEvent.touchStart(carousel, { touches: [{ clientX: 250 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 50 }] });
    expect(title()).toHaveTextContent("A new generation.");
  });
});
