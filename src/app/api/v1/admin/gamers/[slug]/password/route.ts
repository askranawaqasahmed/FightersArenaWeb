import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { resetGamerPassword } from "@/lib/admin-gamer-data";
import { isSameSiteRequest } from "@/lib/request-origin";

const requestSchema = z.object({ password: z.string().min(6).max(128).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!isSameSiteRequest(request)) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");

    const { slug } = await params;
    const input = requestSchema.parse(await request.json().catch(() => ({})));
    const password = input.password ?? "123456";
    const result = await resetGamerPassword(slug, password, actor.userId);
    if (!result) return apiProblem(404, "GAMER_NOT_FOUND", "Not found", "No player exists with that profile address.");
    // The player is required to replace this the next time they sign in.
    return apiData({ password, revokedSessions: result.revokedSessions });
  } catch (error) {
    return invalidInput(error);
  }
}
