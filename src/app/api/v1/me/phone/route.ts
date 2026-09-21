import { z } from "zod";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { changeOwnPhone } from "@/lib/me-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestGamer } from "@/lib/request-auth";

const requestSchema = z.object({
  phone: z.string().trim().max(24).nullable(),
});

export async function PATCH(request: Request) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    if (!checkRateLimit(`phone:${account.userId}`, { limit: 10, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many changes. Try again later.");
    }

    const input = requestSchema.parse(await request.json());
    let phone: string | null = null;
    if (input.phone && input.phone.trim() !== "") {
      try { phone = normalizePhone(input.phone); }
      catch { return apiProblem(422, "INVALID_PHONE", "Invalid phone number", "Use a valid mobile number, for example 03001234567."); }
    }

    const result = await changeOwnPhone(account.userId, phone);
    if (!result.ok) {
      return apiProblem(409, "PHONE_TAKEN", "Mobile number already in use", "Another account already uses this mobile number.");
    }
    return apiData({ phone });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return apiProblem(409, "PHONE_TAKEN", "Mobile number already in use", "Another account already uses this mobile number.");
    }
    return invalidInput(error);
  }
}
