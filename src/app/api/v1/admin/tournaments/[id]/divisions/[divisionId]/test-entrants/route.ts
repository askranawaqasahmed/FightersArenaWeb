import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { divisions } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { addTestEntrantsToDivision } from "@/lib/admin-tournament-draft";

const requestSchema = z.object({ count: z.number().int().min(2).max(64).default(8) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, divisionId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    const [division] = await db.select({ id: divisions.id }).from(divisions).where(and(eq(divisions.id, parsedDivisionId), eq(divisions.tournamentId, tournamentId))).limit(1);
    if (!division) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game tournament does not belong to this event.");
    const input = requestSchema.parse(await request.json());
    return apiData(await addTestEntrantsToDivision(parsedDivisionId, input.count, { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined }));
  } catch (error) {
    return invalidInput(error);
  }
}
