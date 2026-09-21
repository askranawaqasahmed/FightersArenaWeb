import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { adminCredentials, roles, sessions, userIdentities, userRoles, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { AdminRole, createAccessToken, createOpaqueToken, hashSecret, isAdminRole } from "@/lib/auth";
import { addDays } from "@/lib/date";
import { verifyPassword } from "@/lib/password";
import { isProvisionedAdmin } from "@/lib/admin-auth";
import { isSameSiteRequest } from "@/lib/request-origin";

const requestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    if (!isSameSiteRequest(request)) return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from this site.");
    const input = requestSchema.parse(await request.json());
    const [account] = await db
      .select({
        userId: users.id,
        passwordHash: adminCredentials.passwordHash,
        createdByUserId: adminCredentials.createdByUserId,
        role: roles.key,
      })
      .from(userIdentities)
      .innerJoin(users, and(eq(users.id, userIdentities.userId), eq(users.status, "active")))
      .innerJoin(adminCredentials, eq(adminCredentials.userId, users.id))
      .innerJoin(userRoles, and(
        eq(userRoles.userId, users.id),
        eq(userRoles.scopeType, "platform"),
        or(isNull(userRoles.expiresAt), gt(userRoles.expiresAt, new Date())),
      ))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), inArray(roles.key, ["super_admin", "admin"])))
      .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, input.email)))
      .limit(1);

    if (!account || !isAdminRole(account.role) || !(await verifyPassword(input.password, account.passwordHash)) || !(await isProvisionedAdmin(account.role, account.createdByUserId))) {
      return apiProblem(401, "INVALID_CREDENTIALS", "Sign in failed", "The email address or password is incorrect.");
    }

    const refreshToken = createOpaqueToken();
    const familyId = crypto.randomUUID();
    const [session] = await db.insert(sessions).values({
      userId: account.userId,
      tokenHash: hashSecret(refreshToken),
      familyId,
      expiresAt: addDays(new Date(), 30),
      userAgent: request.headers.get("user-agent"),
    }).returning({ id: sessions.id });

    const role: AdminRole = account.role;
    const accessToken = await createAccessToken(account.userId, session.id, "admin", role);
    const response = apiData({ user: { id: account.userId, email: input.email, role } });
    response.cookies.set("efa_refresh", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/v1/auth",
      maxAge: 30 * 86_400,
    });
    response.cookies.set("efa_access", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    return response;
  } catch (error) {
    return invalidInput(error);
  }
}
