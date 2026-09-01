import { apiData, apiProblem } from "@/lib/api";
import { getAdminSessionFromToken } from "@/lib/admin-auth";
import { verifyAccessToken } from "@/lib/auth";
import { getGamerSessionFromToken } from "@/lib/gamer-auth";
import { getBearerOrCookieToken } from "@/lib/request-auth";

export async function GET(request: Request) {
  const token = await getBearerOrCookieToken(request);
  if (!token) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Provide a valid bearer token.");
  try {
    const payload = await verifyAccessToken(token);
    const account = payload.accountType === "admin"
      ? await getAdminSessionFromToken(token)
      : payload.accountType === "gamer"
        ? await getGamerSessionFromToken(token)
        : null;
    if (!account) return apiProblem(401, "SESSION_INVALID", "Authentication failed", "The account or session is no longer active.");
    return apiData({ id: payload.sub, sessionId: payload.sid, accountType: payload.accountType });
  } catch {
    return apiProblem(401, "TOKEN_INVALID", "Authentication failed", "The access token is invalid or expired.");
  }
}
