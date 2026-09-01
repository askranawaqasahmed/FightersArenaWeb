import "server-only";

import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { adminCredentials, roles, sessions, userIdentities, userRoles, users } from "@/db/schema";
import { AdminRole, isAdminRole, verifyAccessToken } from "@/lib/auth";

export type AdminSession = {
  userId: string;
  sessionId: string;
  email: string;
  role: AdminRole;
};

export async function isProvisionedAdmin(role: AdminRole, createdByUserId: string | null) {
  if (role === "super_admin") return true;
  if (!createdByUserId) return false;

  const [creatorRole] = await db
    .select({ role: roles.key })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.key, "super_admin")))
    .where(and(eq(userRoles.userId, createdByUserId), eq(userRoles.scopeType, "platform")))
    .limit(1);
  return creatorRole?.role === "super_admin";
}

export async function getAdminSessionFromToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token);
    if (payload.accountType !== "admin" || !isAdminRole(payload.adminRole) || !payload.sub || typeof payload.sid !== "string") return null;

    const [account] = await db
      .select({
        userId: users.id,
        sessionId: sessions.id,
        email: userIdentities.normalizedValue,
        role: roles.key,
        createdByUserId: adminCredentials.createdByUserId,
      })
      .from(users)
      .innerJoin(sessions, and(
        eq(sessions.id, payload.sid),
        eq(sessions.userId, users.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ))
      .innerJoin(adminCredentials, eq(adminCredentials.userId, users.id))
      .innerJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.type, "email")))
      .innerJoin(userRoles, and(
        eq(userRoles.userId, users.id),
        eq(userRoles.scopeType, "platform"),
        or(isNull(userRoles.expiresAt), gt(userRoles.expiresAt, new Date())),
      ))
      .innerJoin(roles, and(eq(roles.id, userRoles.roleId), inArray(roles.key, ["super_admin", "admin"])))
      .where(and(eq(users.id, payload.sub), eq(users.status, "active"), eq(roles.key, payload.adminRole)))
      .limit(1);

    if (!account || !isAdminRole(account.role) || !(await isProvisionedAdmin(account.role, account.createdByUserId))) return null;
    return { userId: account.userId, sessionId: account.sessionId, email: account.email, role: account.role };
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  return getAdminSessionFromToken(cookieStore.get("efa_access")?.value);
}

export async function requireAdmin() {
  const account = await getCurrentAdmin();
  if (!account) redirect("/admin-login");
  return account;
}
