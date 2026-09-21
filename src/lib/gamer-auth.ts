import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { gamerCredentials, sessions, userIdentities, users } from "@/db/schema";
import { verifyAccessToken } from "@/lib/auth";

export type GamerSession = {
  userId: string;
  sessionId: string;
  phone: string | null;
  email: string | null;
  mustChangePassword: boolean;
};

export async function getGamerSessionFromToken(token: string | undefined): Promise<GamerSession | null> {
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    if (payload.accountType !== "gamer" || !payload.sub || typeof payload.sid !== "string") return null;
    const [account] = await db.select({ userId: users.id, sessionId: sessions.id })
      .from(users)
      .innerJoin(sessions, and(eq(sessions.id, payload.sid), eq(sessions.userId, users.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .where(and(eq(users.id, payload.sub), eq(users.status, "active")))
      .limit(1);
    if (!account) return null;

    const identities = await db.select({ type: userIdentities.type, value: userIdentities.normalizedValue })
      .from(userIdentities).where(eq(userIdentities.userId, account.userId));
    const [credentials] = await db.select({ mustChangePassword: gamerCredentials.mustChangePassword })
      .from(gamerCredentials).where(eq(gamerCredentials.userId, account.userId)).limit(1);

    return {
      ...account,
      phone: identities.find((identity) => identity.type === "phone")?.value ?? null,
      email: identities.find((identity) => identity.type === "email")?.value ?? null,
      mustChangePassword: credentials?.mustChangePassword ?? false,
    };
  } catch {
    return null;
  }
}

export async function requireGamer() {
  const cookieStore = await cookies();
  const account = await getGamerSessionFromToken(cookieStore.get("efa_access")?.value);
  if (!account) redirect("/login");
  return account;
}
