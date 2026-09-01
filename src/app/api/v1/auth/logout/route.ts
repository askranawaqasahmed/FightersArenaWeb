import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { hashSecret } from "@/lib/auth";

export async function POST(request: Request) {
  let refreshToken: string | undefined;
  try {
    const body = await request.json() as { refreshToken?: unknown };
    if (typeof body?.refreshToken === "string" && body.refreshToken.length > 0) refreshToken = body.refreshToken;
  } catch {}
  if (!refreshToken) {
    const cookieStore = await cookies();
    refreshToken = cookieStore.get("efa_refresh")?.value;
  }
  if (refreshToken) await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, hashSecret(refreshToken)));

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set("efa_refresh", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/v1/auth", maxAge: 0 });
  response.cookies.set("efa_access", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
