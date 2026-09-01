import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { sessions, userIdentities, users } from "@/db/schema";
import { verifyAccessToken } from "@/lib/auth";

export type GamerSession = { userId: string; sessionId: string; phone: string };

export async function getGamerSessionFromToken(token: string | undefined): Promise<GamerSession | null> {
  if (!token) return null;
  try {
    const payload = await verifyAccessToken(token);
    if (payload.accountType !== "gamer" || !payload.sub || typeof payload.sid !== "string") return null;
    const [account] = await db.select({ userId: users.id, sessionId: sessions.id, phone: userIdentities.normalizedValue })
      .from(users)
      .innerJoin(sessions, and(eq(sessions.id, payload.sid), eq(sessions.userId, users.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
      .innerJoin(userIdentities, and(eq(userIdentities.userId, users.id), eq(userIdentities.type, "phone")))
      .where(and(eq(users.id, payload.sub), eq(users.status, "active")))
      .limit(1);
    return account ?? null;
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
