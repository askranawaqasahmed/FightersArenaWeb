import { apiData, apiProblem } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { listSelectableGamers } from "@/lib/admin-gamer-data";

/** Active players, for pickers that assign entrants to a competition. */
export async function GET(request: Request) {
  const actor = await getRequestAdmin(request);
  if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
  return apiData({ gamers: await listSelectableGamers() });
}
