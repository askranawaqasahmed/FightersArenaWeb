import { apiData, apiProblem } from "@/lib/api";
import { getOwnRegistrations } from "@/lib/me-data";
import { getRequestGamer } from "@/lib/request-auth";

export async function GET(request: Request) {
  const account = await getRequestGamer(request);
  if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
  return apiData({ registrations: await getOwnRegistrations(account.userId) });
}
