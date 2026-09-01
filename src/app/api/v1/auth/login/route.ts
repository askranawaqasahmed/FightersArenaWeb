import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { gamerCredentials, gamerProfiles, userIdentities, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { createAccessToken } from "@/lib/auth";
import { attachSessionCookies, createSessionRecord } from "@/lib/gamer-session";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  phone: z.string().min(8).max(24),
  password: z.string().min(1).max(128),
});

const invalidCredentials = () => apiProblem(401, "INVALID_CREDENTIALS", "Sign in failed", "The phone number or password is incorrect.");

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    let phone: string;
    try { phone = normalizePhone(input.phone); } catch { return invalidCredentials(); }
    if (!checkRateLimit(`login:${phone}`, { limit: 10, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many sign-in attempts. Try again later.");
    }

    const [account] = await db.select({
      userId: users.id,
      status: users.status,
      passwordHash: gamerCredentials.passwordHash,
    }).from(userIdentities)
      .innerJoin(users, eq(users.id, userIdentities.userId))
      .innerJoin(gamerCredentials, eq(gamerCredentials.userId, users.id))
      .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, phone)))
      .limit(1);
    if (!account || !(await verifyPassword(input.password, account.passwordHash))) return invalidCredentials();
    if (account.status !== "active") {
      return apiProblem(403, "ACCOUNT_BLOCKED", "Account blocked", "This gamer account has been blocked by an administrator.");
    }

    const [profile] = await db.select({
      slug: gamerProfiles.slug,
      displayName: gamerProfiles.displayName,
      handle: gamerProfiles.handle,
    }).from(gamerProfiles).where(eq(gamerProfiles.userId, account.userId)).limit(1);

    const session = await createSessionRecord(db, account.userId, request.headers.get("user-agent"));
    const accessToken = await createAccessToken(account.userId, session.sessionId, "gamer");
    const response = apiData({
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900,
      refreshToken: session.refreshToken,
      user: { id: account.userId, phone, accountType: "gamer", profile: profile ?? null },
    });
    return attachSessionCookies(response, accessToken, session.refreshToken);
  } catch (error) {
    return invalidInput(error);
  }
}
