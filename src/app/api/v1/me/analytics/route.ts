import { apiData, apiProblem } from "@/lib/api";
import { getOwnGamerAnalytics } from "@/lib/public-gamer-data";
import { getRequestGamer } from "@/lib/request-auth";

export async function GET(request: Request) {
  const account = await getRequestGamer(request);
  if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
  const analytics = await getOwnGamerAnalytics(account.userId);
  if (!analytics) return apiProblem(404, "PROFILE_NOT_FOUND", "Profile not found", "Create your player profile first.");
  return apiData({ analytics });
}
