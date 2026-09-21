import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { replaceDivisionPlacements } from "@/lib/admin-placement-data";

const requestSchema = z.object({
  placements: z.array(z.object({
    gamerId: z.uuid(),
    finalRank: z.number().int().min(1).max(9999).nullable(),
    placementLabel: z.string().trim().max(40).nullish(),
  })).max(256),
});

export async function PUT(request: Request, { params }: { params: Promise<{ divisionId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");

    const { divisionId } = await params;
    const input = requestSchema.parse(await request.json());
    const result = await replaceDivisionPlacements(divisionId, input.placements, actor.userId);
    if (!result) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "No competition exists with that id.");
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
