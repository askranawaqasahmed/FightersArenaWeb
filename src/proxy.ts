import { NextRequest, NextResponse } from "next/server";
import { isAdminRole, verifyAccessToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("efa_access")?.value;
  let permitted = false;
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      permitted = request.nextUrl.pathname.startsWith("/admin")
        ? payload.accountType === "admin" && isAdminRole(payload.adminRole)
        : payload.accountType === "gamer";
    } catch {
      permitted = false;
    }
  }
  if (!permitted) {
    const loginUrl = new URL(request.nextUrl.pathname.startsWith("/admin") ? "/admin-login" : "/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/dashboard/:path*"] };
