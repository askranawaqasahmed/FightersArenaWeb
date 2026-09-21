import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { setGamerAccountStatus } from "@/lib/gamer-account-access";
import { isSameSiteRequest } from "@/lib/request-origin";

const requestSchema = z.object({ status: z.enum(["active", "suspended"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!isSameSiteRequest(request)) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const input = requestSchema.parse(await request.json());
    const slug = z.string().trim().min(1).max(80).parse((await params).slug);
    const result = await setGamerAccountStatus(slug, input.status, actor.userId);
    if (!result) return apiProblem(404, "GAMER_NOT_FOUND", "Not found", "No database-backed gamer account uses this slug.");
    if (result.blocked) return apiProblem(409, "ACCOUNT_DELETED", "Account unavailable", "A deleted gamer account cannot be reactivated or blocked.");
    return apiData({ slug, status: result.account.status, revokedSessions: result.revokedSessions ?? 0 });
  } catch (error) {
    return invalidInput(error);
  }
}
