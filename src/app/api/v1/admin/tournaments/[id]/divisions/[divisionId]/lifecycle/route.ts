import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { divisions } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { completeDivision, getDivisionPreviewTx, startDivision } from "@/lib/tournament-lifecycle";

const actionSchema = z.object({ action: z.enum(["start", "complete"]) });

async function divisionBelongsToEvent(tournamentId: string, divisionId: string) {
  const [division] = await db.select({ id: divisions.id }).from(divisions).where(and(
    eq(divisions.id, divisionId),
    eq(divisions.tournamentId, tournamentId),
  )).limit(1);
  return Boolean(division);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, divisionId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    if (!(await divisionBelongsToEvent(tournamentId, parsedDivisionId))) {
      return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game tournament does not belong to this event.");
    }
    return apiData(await db.transaction((tx) => getDivisionPreviewTx(tx, parsedDivisionId)));
  } catch (error) {
    return invalidInput(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, divisionId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    if (!(await divisionBelongsToEvent(tournamentId, parsedDivisionId))) {
      return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game tournament does not belong to this event.");
    }
    const input = actionSchema.parse(await request.json());
    const context = { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined };
    const result = input.action === "start"
      ? await startDivision(parsedDivisionId, context)
      : await completeDivision(parsedDivisionId, context);
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
