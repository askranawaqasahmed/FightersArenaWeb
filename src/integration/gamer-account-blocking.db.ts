import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { POST as requestOtp } from "@/app/api/v1/auth/otp/request/route";
import { POST as verifyOtp } from "@/app/api/v1/auth/otp/verify/route";
import { db } from "@/db/client";
import { auditEvents, authChallenges, gamerProfiles, sessions, userIdentities, users } from "@/db/schema";
import { createAccessToken, createOpaqueToken, hashSecret } from "@/lib/auth";
import { addDays } from "@/lib/date";
import { env } from "@/lib/env";
import { setGamerAccountStatus } from "@/lib/gamer-account-access";
import { getGamerSessionFromToken } from "@/lib/gamer-auth";

vi.mock("server-only", () => ({}));

describe("gamer account blocking against PostgreSQL", () => {
  it("suspends the account, revokes sessions, denies OTP login, and requires a new login after unblock", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `blocked-gamer-${suffix}`;
    const phone = `+92310${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;
    const [actor] = await db.insert(users).values({ status: "active" }).returning({ id: users.id });
    const [gamer] = await db.insert(users).values({ status: "active" }).returning({ id: users.id });

    try {
      await db.insert(userIdentities).values({ userId: gamer.id, type: "phone", normalizedValue: phone, verifiedAt: new Date() });
      await db.insert(gamerProfiles).values({ userId: gamer.id, slug, displayName: "Blocked Test Gamer", handle: `BLOCK${suffix}` });
      const refreshToken = createOpaqueToken();
      const [session] = await db.insert(sessions).values({
        userId: gamer.id,
        tokenHash: hashSecret(refreshToken),
        familyId: crypto.randomUUID(),
        expiresAt: addDays(new Date(), 30),
      }).returning({ id: sessions.id });
      const accessToken = await createAccessToken(gamer.id, session.id, "gamer");
      await expect(getGamerSessionFromToken(accessToken)).resolves.toMatchObject({ userId: gamer.id });

      await expect(setGamerAccountStatus(slug, "suspended", actor.id)).resolves.toMatchObject({
        account: { userId: gamer.id, status: "suspended" },
        revokedSessions: 1,
      });
      const [blockedUser] = await db.select({ status: users.status }).from(users).where(eq(users.id, gamer.id));
      const [revokedSession] = await db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, session.id));
      expect(blockedUser.status).toBe("suspended");
      expect(revokedSession.revokedAt).toBeInstanceOf(Date);
      await expect(getGamerSessionFromToken(accessToken)).resolves.toBeNull();

      const otpRequest = await requestOtp(new Request("http://localhost/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      }));
      const otpBody = await otpRequest.json();
      const otpVerification = await verifyOtp(new Request("http://localhost/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code: env.DEV_OTP_CODE, challengeId: otpBody.data.challengeId }),
      }));
      expect(otpVerification.status).toBe(403);
      await expect(otpVerification.json()).resolves.toMatchObject({ code: "ACCOUNT_BLOCKED" });

      await expect(setGamerAccountStatus(slug, "active", actor.id)).resolves.toMatchObject({
        account: { userId: gamer.id, status: "active" },
      });
      await expect(getGamerSessionFromToken(accessToken)).resolves.toBeNull();
      const actions = await db.select({ action: auditEvents.action }).from(auditEvents)
        .where(and(eq(auditEvents.actorUserId, actor.id), eq(auditEvents.entityId, gamer.id)));
      expect(actions.map((item) => item.action)).toEqual(expect.arrayContaining(["gamer.blocked", "gamer.unblocked"]));
    } finally {
      await db.delete(authChallenges).where(eq(authChallenges.identity, phone));
      await db.delete(auditEvents).where(eq(auditEvents.actorUserId, actor.id));
      await db.delete(users).where(eq(users.id, gamer.id));
      await db.delete(users).where(eq(users.id, actor.id));
    }
  });
});
