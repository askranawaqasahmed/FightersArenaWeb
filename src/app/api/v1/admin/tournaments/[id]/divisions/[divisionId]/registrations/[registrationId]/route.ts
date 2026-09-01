import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { divisions } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { reviewRegistrationTx } from "@/lib/tournament-lifecycle";

const requestSchema = z.object({ action: z.enum(["approve", "reject"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; divisionId: string; registrationId: string }> },
) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, divisionId, registrationId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    const parsedRegistrationId = z.uuid().parse(registrationId);
    const input = requestSchema.parse(await request.json());
    const context = { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined };

    const result = await db.transaction(async (tx) => {
      const [division] = await tx.select({ id: divisions.id }).from(divisions).where(and(
        eq(divisions.id, parsedDivisionId),
        eq(divisions.tournamentId, tournamentId),
      )).limit(1);
      if (!division) return null;
      return reviewRegistrationTx(tx, { divisionId: parsedDivisionId, registrationId: parsedRegistrationId, action: input.action }, context);
    });
    if (!result) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game competition does not belong to this event.");
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
