import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { gamerCredentials, gamerProfiles, userIdentities, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { createAccessToken } from "@/lib/auth";
import { attachSessionCookies, createSessionRecord } from "@/lib/gamer-session";
import { hashPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { uniqueProfileSlug } from "@/lib/slug";

const requestSchema = z.object({
  phone: z.string().min(8).max(24),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(2).max(100),
  email: z.email().max(255).optional(),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    let phone: string;
    try { phone = normalizePhone(input.phone); } catch { return apiProblem(422, "INVALID_PHONE", "Invalid phone number", "Use a valid international mobile number."); }
    if (!checkRateLimit(`signup:${phone}`, { limit: 5, windowMs: 15 * 60_000 })) {
      return apiProblem(429, "RATE_LIMITED", "Too many attempts", "Too many signup attempts. Try again later.");
    }
    const email = input.email?.trim().toLowerCase();
    const passwordHash = await hashPassword(input.password);

    const result = await db.transaction(async (tx) => {
      const [phoneTaken] = await tx.select({ id: userIdentities.id }).from(userIdentities)
        .where(and(eq(userIdentities.type, "phone"), eq(userIdentities.normalizedValue, phone))).limit(1);
      if (phoneTaken) return { conflict: "PHONE_TAKEN" as const };
      if (email) {
        const [emailTaken] = await tx.select({ id: userIdentities.id }).from(userIdentities)
          .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, email))).limit(1);
        if (emailTaken) return { conflict: "EMAIL_TAKEN" as const };
      }
      const [user] = await tx.insert(users).values({ status: "active", acceptedTermsVersion: "2026-08" }).returning({ id: users.id });
      await tx.insert(userIdentities).values({ userId: user.id, type: "phone", normalizedValue: phone });
      if (email) await tx.insert(userIdentities).values({ userId: user.id, type: "email", normalizedValue: email });
      await tx.insert(gamerCredentials).values({ userId: user.id, passwordHash });
      const slug = await uniqueProfileSlug(tx, input.displayName);
      const [profile] = await tx.insert(gamerProfiles).values({
        userId: user.id,
        slug,
        displayName: input.displayName,
        handle: slug,
      }).returning({ slug: gamerProfiles.slug, displayName: gamerProfiles.displayName, handle: gamerProfiles.handle });
      const session = await createSessionRecord(tx, user.id, request.headers.get("user-agent"));
      return { userId: user.id, profile, ...session };
    });

    if ("conflict" in result && result.conflict) {
      const conflict: "PHONE_TAKEN" | "EMAIL_TAKEN" = result.conflict;
      const detail = conflict === "PHONE_TAKEN"
        ? "An account with this phone number already exists. Sign in instead."
        : "An account with this email address already exists. Sign in instead.";
      return apiProblem(409, conflict, "Account already exists", detail);
    }

    const accessToken = await createAccessToken(result.userId, result.sessionId, "gamer");
    const response = apiData({
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900,
      refreshToken: result.refreshToken,
      user: { id: result.userId, phone, accountType: "gamer", profile: result.profile },
    }, { status: 201 });
    return attachSessionCookies(response, accessToken, result.refreshToken);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      return apiProblem(409, "PHONE_TAKEN", "Account already exists", "An account with this phone number already exists. Sign in instead.");
    }
    return invalidInput(error);
  }
}
