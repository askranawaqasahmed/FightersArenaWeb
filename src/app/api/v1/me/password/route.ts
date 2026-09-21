import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { changeOwnPassword } from "@/lib/me-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestGamer } from "@/lib/request-auth";

const requestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    if (!checkRateLimit(`pwd:${account.userId}`, { limit: 5, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many password attempts. Try again later.");
    }
    const input = requestSchema.parse(await request.json());
    const result = await changeOwnPassword(account.userId, account.sessionId, input.currentPassword, input.newPassword);
    if (!result.ok) {
      if (result.reason === "NO_PASSWORD") {
        return apiProblem(409, "NO_PASSWORD", "No password set", "This account has no password yet. Contact an administrator.");
      }
      if (result.reason === "SAME_PASSWORD") {
        return apiProblem(422, "SAME_PASSWORD", "Choose a new password", "The new password must be different from your current one.");
      }
      return apiProblem(403, "INVALID_PASSWORD", "Incorrect password", "Your current password is incorrect.");
    }
    return apiData({ updated: true, revokedSessions: result.revokedSessions ?? 0 });
  } catch (error) {
    return invalidInput(error);
  }
}
