import { z } from "zod";
import { divisions } from "@/db/schema";
import { db } from "@/db/client";
import { and, eq } from "drizzle-orm";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { getDivisionAvailabilityTx, setRegistrationPolicyTx } from "@/lib/tournament-lifecycle";

const requestSchema = z.object({
  restricted: z.boolean(),
  limit: z.number().int().min(2).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, divisionId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    const input = requestSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [division] = await tx.select({ id: divisions.id }).from(divisions).where(and(
        eq(divisions.id, parsedDivisionId),
        eq(divisions.tournamentId, tournamentId),
      )).limit(1);
      if (!division) return null;
      const policy = await setRegistrationPolicyTx(tx, parsedDivisionId, input.restricted, input.limit ?? null, {
        actorUserId: actor.userId,
        requestId: request.headers.get("x-request-id") ?? undefined,
      });
      return { policy, availability: await getDivisionAvailabilityTx(tx, parsedDivisionId) };
    });
    if (!result) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game competition does not belong to this event.");
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
