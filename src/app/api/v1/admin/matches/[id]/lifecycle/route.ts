import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { adjustMatchScore, editMatchParticipants, editMatchResult, finishMatch, startMatch, stopMatch } from "@/lib/tournament-lifecycle";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("stop") }),
  z.object({
    action: z.literal("score_adjust"),
    slot: z.union([z.literal(1), z.literal(2)]),
    delta: z.union([z.literal(1), z.literal(-1)]),
  }),
  z.object({
    action: z.literal("finish"),
    winnerParticipantId: z.uuid().nullable(),
    scores: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    startNext: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("edit_participants"),
    participantIds: z.tuple([z.uuid(), z.uuid()]),
    reason: z.string().trim().min(3).max(500),
  }),
  z.object({
    action: z.literal("edit_result"),
    winnerParticipantId: z.uuid().nullable(),
    scores: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const matchId = z.uuid().parse((await params).id);
    const input = requestSchema.parse(await request.json());
    const context = { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined };
    if (input.action === "start") return apiData(await startMatch(matchId, context));
    if (input.action === "stop") return apiData(await stopMatch(matchId, context));
    if (input.action === "score_adjust") {
      return apiData(await adjustMatchScore({ matchId, slot: input.slot, delta: input.delta }, context));
    }
    if (input.action === "edit_participants") {
      return apiData(await editMatchParticipants({ matchId, participantIds: input.participantIds, reason: input.reason }, context));
    }
    if (input.action === "edit_result") {
      return apiData(await editMatchResult({
        matchId,
        winnerParticipantId: input.winnerParticipantId,
        scores: input.scores,
        reason: input.reason,
      }, context));
    }
    return apiData(await finishMatch({
      matchId,
      winnerParticipantId: input.winnerParticipantId,
      scores: input.scores,
      startNext: input.startNext,
    }, context));
  } catch (error) {
    return invalidInput(error);
  }
}
