import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { completeTournament, setTournamentRegistrationState, startTournament } from "@/lib/tournament-lifecycle";

const requestSchema = z.object({ action: z.enum(["publish", "open_registration", "close_registration", "start", "complete"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id } = await params;
    const input = requestSchema.parse(await request.json());
    const context = { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined };
    const tournamentId = z.uuid().parse(id);
    const result = input.action === "start"
      ? await startTournament(tournamentId, context)
      : input.action === "complete"
        ? await completeTournament(tournamentId, context)
        : await setTournamentRegistrationState(tournamentId, input.action, context);
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
