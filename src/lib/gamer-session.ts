import type { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { createOpaqueToken, hashSecret } from "@/lib/auth";
import { addDays } from "@/lib/date";

type DbOrTransaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createSessionRecord(tx: DbOrTransaction, userId: string, userAgent: string | null) {
  const refreshToken = createOpaqueToken();
  const [session] = await tx.insert(sessions).values({
    userId,
    tokenHash: hashSecret(refreshToken),
    familyId: crypto.randomUUID(),
    expiresAt: addDays(new Date(), 30),
    userAgent,
  }).returning({ id: sessions.id });
  return { sessionId: session.id, refreshToken };
}

export function attachSessionCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set("efa_refresh", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/v1/auth", maxAge: 30 * 86_400 });
  response.cookies.set("efa_access", accessToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 900 });
  return response;
}
