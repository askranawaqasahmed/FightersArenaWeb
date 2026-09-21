import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { authChallenges, sessions, userIdentities, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { createAccessToken, createOpaqueToken, hashSecret } from "@/lib/auth";
import { addDays } from "@/lib/date";
import { env } from "@/lib/env";

const requestSchema = z.object({ phone: z.string(), challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });

export async function POST(request: Request) {
  try {
    if (env.NODE_ENV === "production") {
      return apiProblem(404, "NOT_FOUND", "Not found", "This endpoint is not available.");
    }
    const input = requestSchema.parse(await request.json());
    let phone: string;
    try { phone = normalizePhone(input.phone); } catch { return apiProblem(422, "INVALID_PHONE", "Invalid phone number", "Use a valid international mobile number."); }
    const [challenge] = await db.select().from(authChallenges).where(and(
      eq(authChallenges.id, input.challengeId), eq(authChallenges.identity, phone), isNull(authChallenges.consumedAt), gt(authChallenges.expiresAt, new Date()),
    )).limit(1);
    if (!challenge || challenge.attempts >= 5) return apiProblem(401, "OTP_INVALID", "Verification failed", "The verification challenge is invalid or expired.");
    if (challenge.codeHash !== hashSecret(`${phone}:${input.code}`)) {
      await db.update(authChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(authChallenges.id, challenge.id));
      return apiProblem(401, "OTP_INVALID", "Verification failed", "The verification code is incorrect.");
    }

    const result = await db.transaction(async (transaction) => {
      await transaction.update(authChallenges).set({ consumedAt: new Date() }).where(eq(authChallenges.id, challenge.id));
      const [existingIdentity] = await transaction.select({
        userId: userIdentities.userId,
        status: users.status,
      }).from(userIdentities)
        .innerJoin(users, eq(users.id, userIdentities.userId))
        .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, phone)))
        .limit(1);
      if (existingIdentity && existingIdentity.status !== "active") {
        return { blocked: true as const, status: existingIdentity.status };
      }
      let userId = existingIdentity?.userId;
      if (!userId) {
        const [user] = await transaction.insert(users).values({ status: "active", acceptedTermsVersion: "2026-08" }).returning({ id: users.id });
        userId = user.id;
        await transaction.insert(userIdentities).values({ userId, type: "phone", normalizedValue: phone, verifiedAt: new Date() });
      }
      const refreshToken = createOpaqueToken();
      const familyId = crypto.randomUUID();
      const [session] = await transaction.insert(sessions).values({ userId, tokenHash: hashSecret(refreshToken), familyId, expiresAt: addDays(new Date(), 30), userAgent: request.headers.get("user-agent") }).returning({ id: sessions.id });
      return { blocked: false as const, userId, sessionId: session.id, refreshToken };
    });

    if (result.blocked) {
      return apiProblem(403, "ACCOUNT_BLOCKED", "Account blocked", "This gamer account has been blocked by an administrator.");
    }

    const accountType = "gamer" as const;
    const accessToken = await createAccessToken(result.userId, result.sessionId, accountType);
    const response = apiData({ accessToken, tokenType: "Bearer", expiresIn: 900, user: { id: result.userId, phone, accountType } });
    response.cookies.set("efa_refresh", result.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", maxAge: 30 * 86_400 });
    response.cookies.set("efa_access", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
    return response;
  } catch (error) { return invalidInput(error); }
}
