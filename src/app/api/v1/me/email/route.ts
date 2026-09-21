import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { clearSessionCookies } from "@/lib/gamer-session";
import { changeOwnEmail } from "@/lib/me-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestGamer } from "@/lib/request-auth";

const requestSchema = z.object({
  email: z.email().max(255),
  currentPassword: z.string().min(1).max(128),
});

export async function PATCH(request: Request) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    if (!checkRateLimit(`email:${account.userId}`, { limit: 5, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many email changes. Try again later.");
    }
    const input = requestSchema.parse(await request.json());
    const result = await changeOwnEmail(account.userId, input.currentPassword, input.email);
    if (!result.ok) {
      if (result.reason === "EMAIL_TAKEN") {
        return apiProblem(409, "EMAIL_TAKEN", "Email already in use", "Another account already uses this email address.");
      }
      if (result.reason === "NO_PASSWORD") {
        return apiProblem(409, "NO_PASSWORD", "No password set", "This account has no password yet. Contact an administrator.");
      }
      return apiProblem(403, "INVALID_PASSWORD", "Incorrect password", "Your current password is incorrect.");
    }
    // The address is the sign-in name, so the session ends here and the
    // player signs back in with the new one.
    return clearSessionCookies(apiData({ email: input.email.trim().toLowerCase(), signedOut: true }));
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return apiProblem(409, "EMAIL_TAKEN", "Email already in use", "Another account already uses this email address.");
    }
    return invalidInput(error);
  }
}
