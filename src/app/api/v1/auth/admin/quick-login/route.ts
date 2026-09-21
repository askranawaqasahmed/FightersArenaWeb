import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { adminCredentials, auditEvents, roles, sessions, userIdentities, userRoles, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { createAccessToken, createOpaqueToken, hashSecret } from "@/lib/auth";
import { addDays } from "@/lib/date";
import { env } from "@/lib/env";
import { isSameSiteRequest } from "@/lib/request-origin";

export async function POST(request: Request) {
  try {
    if (env.NODE_ENV === "production") {
      return apiProblem(404, "NOT_FOUND", "Not found", "This endpoint is not available.");
    }
    if (!isSameSiteRequest(request)) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from this site.");
    }

    const [account] = await db.select({
      userId: users.id,
      email: userIdentities.normalizedValue,
    }).from(users)
      .innerJoin(adminCredentials, eq(adminCredentials.userId, users.id))
      .innerJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.type, "email")))
      .innerJoin(userRoles, and(
        eq(userRoles.userId, users.id),
        eq(userRoles.scopeType, "platform"),
        or(isNull(userRoles.expiresAt), gt(userRoles.expiresAt, new Date())),
      ))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.key, "super_admin")))
      .where(eq(users.status, "active"))
      .limit(1);
    if (!account) {
      return apiProblem(503, "SUPERADMIN_NOT_SEEDED", "Quick sign-in unavailable", "Seed the development database before using quick sign-in.");
    }

    const refreshToken = createOpaqueToken();
    const [session] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(sessions).values({
        userId: account.userId,
        tokenHash: hashSecret(refreshToken),
        familyId: crypto.randomUUID(),
        expiresAt: addDays(new Date(), 30),
        userAgent: request.headers.get("user-agent"),
      }).returning({ id: sessions.id });
      await tx.insert(auditEvents).values({
        actorUserId: account.userId,
        action: "admin.quick_signed_in",
        entityType: "session",
        entityId: created.id,
        metadata: { developmentOnly: true },
      });
      return [created];
    });

    const accessToken = await createAccessToken(account.userId, session.id, "admin", "super_admin");
    const response = apiData({ user: { id: account.userId, email: account.email, role: "super_admin" } });
    response.cookies.set("efa_refresh", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 30 * 86_400,
    });
    response.cookies.set("efa_access", accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    return response;
  } catch (error) {
    return invalidInput(error);
  }
}
