import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetRateLimits } from "./rate-limit";

afterEach(() => { resetRateLimits(); vi.useRealTimers(); });

describe("checkRateLimit", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(checkRateLimit("signup:+920000000001", { limit: 5, windowMs: 60_000 })).toBe(true);
    }
    expect(checkRateLimit("signup:+920000000001", { limit: 5, windowMs: 60_000 })).toBe(false);
  });

  it("tracks keys independently", () => {
    expect(checkRateLimit("login:a", { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("login:b", { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("login:a", { limit: 1, windowMs: 60_000 })).toBe(false);
  });

  it("allows again after the window slides past old hits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T10:00:00Z"));
    expect(checkRateLimit("otp:+92", { limit: 1, windowMs: 60_000 })).toBe(true);
    expect(checkRateLimit("otp:+92", { limit: 1, windowMs: 60_000 })).toBe(false);
    vi.setSystemTime(new Date("2026-08-21T10:01:01Z"));
    expect(checkRateLimit("otp:+92", { limit: 1, windowMs: 60_000 })).toBe(true);
  });
});
