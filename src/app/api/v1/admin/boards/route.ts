import { asc, eq } from "drizzle-orm";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { db } from "@/db/client";
import { divisions, matches, stages, streamBoards, tournaments } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const boards = await db
      .select({
        number: streamBoards.number,
        matchId: streamBoards.matchId,
        featuredSlot: streamBoards.featuredSlot,
        updatedAt: streamBoards.updatedAt,
        matchCode: matches.code,
        matchStatus: matches.status,
        tournamentName: tournaments.name,
      })
      .from(streamBoards)
      .leftJoin(matches, eq(matches.id, streamBoards.matchId))
      .leftJoin(stages, eq(stages.id, matches.stageId))
      .leftJoin(divisions, eq(divisions.id, stages.divisionId))
      .leftJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
      .orderBy(asc(streamBoards.number));
    return apiData({ boards });
  } catch (error) {
    return invalidInput(error);
  }
}
