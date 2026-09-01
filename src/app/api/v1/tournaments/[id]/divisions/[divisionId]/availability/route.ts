import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { divisions } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { resolveTournamentId } from "@/lib/public-tournament-data";
import { getDivisionAvailabilityTx } from "@/lib/tournament-lifecycle";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const { id, divisionId } = await params;
    const tournamentId = await resolveTournamentId(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    if (!tournamentId) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");
    const result = await db.transaction(async (tx) => {
      const [division] = await tx.select({ id: divisions.id }).from(divisions).where(and(
        eq(divisions.id, parsedDivisionId),
        eq(divisions.tournamentId, tournamentId),
      )).limit(1);
      return division ? getDivisionAvailabilityTx(tx, parsedDivisionId) : null;
    });
    if (!result) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game competition does not belong to this event.");
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
