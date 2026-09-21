import { addMinutes } from "@/lib/date";
import { db } from "@/db/client";
import { authChallenges } from "@/db/schema";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { hashSecret } from "@/lib/auth";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const requestSchema = z.object({ phone: z.string().min(8).max(24) });

export async function POST(request: Request) {
  try {
    if (env.NODE_ENV === "production") {
      return apiProblem(404, "NOT_FOUND", "Not found", "This endpoint is not available.");
    }
    const input = requestSchema.parse(await request.json());
    let phone: string;
    try { phone = normalizePhone(input.phone); } catch { return apiProblem(422, "INVALID_PHONE", "Invalid phone number", "Use a valid international mobile number."); }
    if (!checkRateLimit(`otp:${phone}`, { limit: 5, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many verification requests. Try again later.");
    }
    const [challenge] = await db.insert(authChallenges).values({
      identity: phone,
      purpose: "login",
      codeHash: hashSecret(`${phone}:${env.DEV_OTP_CODE}`),
      expiresAt: addMinutes(new Date(), 10),
    }).returning({ id: authChallenges.id, expiresAt: authChallenges.expiresAt });
    return apiData({ challengeId: challenge.id, expiresAt: challenge.expiresAt.toISOString(), ...(env.NODE_ENV === "development" ? { debugCode: env.DEV_OTP_CODE } : {}) }, { status: 201 });
  } catch (error) { return invalidInput(error); }
}
