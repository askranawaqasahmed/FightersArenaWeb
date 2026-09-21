import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://fightersarena.ideageek.pk" } }));

const { isSameSiteRequest } = await import("@/lib/request-origin");

function requestWith(url: string, headers: Record<string, string>) {
  return new Request(url, { method: "POST", headers });
}

describe("isSameSiteRequest", () => {
  it("accepts the public origin when the app is behind a reverse proxy", () => {
    // Caddy forwards to 127.0.0.1:4005, so request.url never matches the browser's origin.
    const request = requestWith("http://127.0.0.1:4005/api/v1/auth/admin/login", {
      origin: "https://fightersarena.ideageek.pk",
      host: "fightersarena.ideageek.pk",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "fightersarena.ideageek.pk",
    });
    expect(isSameSiteRequest(request)).toBe(true);
  });

  it("accepts the configured app URL even without forwarded headers", () => {
    const request = requestWith("http://127.0.0.1:4005/api/v1/admin/users", {
      origin: "https://fightersarena.ideageek.pk",
    });
    expect(isSameSiteRequest(request)).toBe(true);
  });

  it("accepts a direct same-origin request in development", () => {
    const request = requestWith("http://localhost:3000/api/v1/admin/users", {
      origin: "http://localhost:3000",
    });
    expect(isSameSiteRequest(request)).toBe(true);
  });

  it("still rejects a cross-site origin", () => {
    const request = requestWith("http://127.0.0.1:4005/api/v1/admin/users", {
      origin: "https://evil.example.com",
      host: "fightersarena.ideageek.pk",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "fightersarena.ideageek.pk",
    });
    expect(isSameSiteRequest(request)).toBe(false);
  });

  it("rejects a look-alike host", () => {
    const request = requestWith("http://127.0.0.1:4005/api/v1/admin/users", {
      origin: "https://fightersarena.ideageek.pk.evil.example.com",
      host: "fightersarena.ideageek.pk",
    });
    expect(isSameSiteRequest(request)).toBe(false);
  });

  it("allows a request with no Origin header, which cannot be a cross-site form post", () => {
    const request = requestWith("http://127.0.0.1:4005/api/v1/admin/users", {});
    expect(isSameSiteRequest(request)).toBe(true);
  });
});
