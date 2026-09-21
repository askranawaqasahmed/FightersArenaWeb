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
  identifier: z.string().trim().min(3).max(255).optional(),
  phone: z.string().min(8).max(24).optional(),
  password: z.string().min(1).max(128),
}).refine((value) => Boolean(value.identifier ?? value.phone), {
  message: "Enter your email address or mobile number.",
  path: ["identifier"],
});

const invalidCredentials = () => apiProblem(401, "INVALID_CREDENTIALS", "Sign in failed", "The email/phone or password is incorrect.");

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const raw = (input.identifier ?? input.phone ?? "").trim();

    let identityType: "email" | "phone";
    let identityValue: string;
    if (raw.includes("@")) {
      identityType = "email";
      identityValue = raw.toLowerCase();
    } else {
      identityType = "phone";
      try { identityValue = normalizePhone(raw); } catch { return invalidCredentials(); }
    }

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`login:${identityValue}`, { limit: 10, windowMs: 15 * 60_000 })
      || !checkRateLimit(`login-ip:${clientIp}`, { limit: 30, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many sign-in attempts. Try again later.");
    }

    const [account] = await db.select({
      userId: users.id,
      status: users.status,
      passwordHash: gamerCredentials.passwordHash,
      mustChangePassword: gamerCredentials.mustChangePassword,
    }).from(userIdentities)
      .innerJoin(users, eq(users.id, userIdentities.userId))
      .innerJoin(gamerCredentials, eq(gamerCredentials.userId, users.id))
      .where(and(eq(userIdentities.type, identityType), eq(userIdentities.normalizedValue, identityValue)))
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

    const identities = await db.select({ type: userIdentities.type, value: userIdentities.normalizedValue })
      .from(userIdentities).where(eq(userIdentities.userId, account.userId));

    const session = await createSessionRecord(db, account.userId, request.headers.get("user-agent"));
    const accessToken = await createAccessToken(account.userId, session.sessionId, "gamer");
    const response = apiData({
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900,
      refreshToken: session.refreshToken,
      mustChangePassword: account.mustChangePassword,
      user: {
        id: account.userId,
        phone: identities.find((identity) => identity.type === "phone")?.value ?? null,
        email: identities.find((identity) => identity.type === "email")?.value ?? null,
        accountType: "gamer",
        profile: profile ?? null,
      },
    });
    return attachSessionCookies(response, accessToken, session.refreshToken);
  } catch (error) {
    return invalidInput(error);
  }
}
