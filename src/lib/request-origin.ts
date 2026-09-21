import { env } from "@/lib/env";

/**
 * The public origins a same-site request may legitimately come from.
 *
 * Behind a reverse proxy the Node server sees its internal address
 * (http://127.0.0.1:4005), while the browser sends the public one
 * (https://fightersarena.ideageek.pk). Comparing the two directly rejects
 * every real request, so the configured app URL and the proxy's forwarded
 * headers are trusted instead.
 */
function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();

  try { origins.add(new URL(request.url).origin); } catch { /* malformed url */ }
  try { origins.add(new URL(env.NEXT_PUBLIC_APP_URL).origin); } catch { /* unset or malformed */ }

  // Caddy and nginx forward the original scheme and host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0].trim();
    origins.add(`${forwardedProto || "https"}://${host}`);
    origins.add(`https://${host}`);
  }

  const host = request.headers.get("host");
  if (host) {
    origins.add(`${forwardedProto || "https"}://${host}`);
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }

  return origins;
}

/**
 * True when the request carries no Origin header (a non-browser client, which
 * cannot be a cross-site form post) or one matching this site.
 */
export function isSameSiteRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins(request).has(origin);
}
