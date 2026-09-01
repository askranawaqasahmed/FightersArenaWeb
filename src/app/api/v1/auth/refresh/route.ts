import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { adminCredentials, roles, sessions, userRoles, users } from "@/db/schema";
import { apiData, apiProblem } from "@/lib/api";
import { createAccessToken, createOpaqueToken, hashSecret, isAdminRole } from "@/lib/auth";
import { addDays } from "@/lib/date";

async function resolveRefreshToken(request: Request) {
  try {
    const body = await request.json() as { refreshToken?: unknown };
    if (typeof body?.refreshToken === "string" && body.refreshToken.length > 0) return body.refreshToken;
  } catch {}
  const cookieStore = await cookies();
  return cookieStore.get("efa_refresh")?.value;
}

export async function POST(request: Request) {
  const refreshToken = await resolveRefreshToken(request);
  if (!refreshToken) return apiProblem(401, "SESSION_INVALID", "Session invalid", "A valid refresh session is required.");
  const [current] = await db.select().from(sessions).where(and(eq(sessions.tokenHash, hashSecret(refreshToken)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!current) return apiProblem(401, "SESSION_INVALID", "Session invalid", "The refresh session is invalid or expired.");

  const nextRefreshToken = createOpaqueToken();
  const [nextSession] = await db.transaction(async (transaction) => {
    await transaction.update(sessions).set({ revokedAt: new Date(), lastUsedAt: new Date() }).where(eq(sessions.id, current.id));
    return transaction.insert(sessions).values({ userId: current.userId, tokenHash: hashSecret(nextRefreshToken), familyId: current.familyId, expiresAt: addDays(new Date(), 30), userAgent: request.headers.get("user-agent") }).returning({ id: sessions.id });
  });
  const [roleRecord] = await db.select({ role: roles.key }).from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, and(eq(users.id, userRoles.userId), eq(users.status, "active")))
    .innerJoin(adminCredentials, eq(adminCredentials.userId, users.id))
    .where(and(
      eq(userRoles.userId, current.userId),
      eq(userRoles.scopeType, "platform"),
      inArray(roles.key, ["super_admin", "admin"]),
      or(isNull(userRoles.expiresAt), gt(userRoles.expiresAt, new Date())),
    ))
    .limit(1);
  const adminRole = isAdminRole(roleRecord?.role) ? roleRecord.role : undefined;
  const accessToken = await createAccessToken(current.userId, nextSession.id, adminRole ? "admin" : "gamer", adminRole);
  const response = apiData({ accessToken, tokenType: "Bearer", expiresIn: 900, refreshToken: nextRefreshToken });
  response.cookies.set("efa_refresh", nextRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", maxAge: 30 * 86_400 });
  response.cookies.set("efa_access", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
  return response;
}
