import { cookies } from "next/headers";
import { getGamerSessionFromToken } from "@/lib/gamer-auth";

export async function getBearerOrCookieToken(request: Request): Promise<string | undefined> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const cookieStore = await cookies();
  return cookieStore.get("efa_access")?.value;
}

export async function getRequestGamer(request: Request) {
  return getGamerSessionFromToken(await getBearerOrCookieToken(request));
}
