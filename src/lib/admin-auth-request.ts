import { getAdminSessionFromToken } from "@/lib/admin-auth";
import { getBearerOrCookieToken } from "@/lib/request-auth";

export async function getRequestAdmin(request: Request) {
  return getAdminSessionFromToken(await getBearerOrCookieToken(request));
}
