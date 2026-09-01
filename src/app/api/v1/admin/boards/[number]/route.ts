import { eq } from "drizzle-orm";
import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { db } from "@/db/client";
import { auditEvents, matches, streamBoards } from "@/db/schema";

export const dynamic = "force-dynamic";

const paramsSchema = z.coerce.number().int().min(1).max(8);
const requestSchema = z.object({
  matchId: z.uuid().nullable(),
  featuredSlot: z.union([z.literal(1), z.literal(2)]).nullable().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const boardNumber = paramsSchema.parse((await params).number);
    const input = requestSchema.parse(await request.json());

    if (input.matchId) {
      const [match] = await db.select({ id: matches.id }).from(matches).where(eq(matches.id, input.matchId)).limit(1);
      if (!match) return apiProblem(404, "MATCH_NOT_FOUND", "Not found", "The match was not found.");
    }

    const [board] = await db
      .insert(streamBoards)
      .values({
        number: boardNumber,
        matchId: input.matchId,
        featuredSlot: input.featuredSlot ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: streamBoards.number,
        set: {
          matchId: input.matchId,
          ...(input.featuredSlot !== undefined ? { featuredSlot: input.featuredSlot } : {}),
          updatedAt: new Date(),
        },
      })
      .returning({
        number: streamBoards.number,
        matchId: streamBoards.matchId,
        featuredSlot: streamBoards.featuredSlot,
        updatedAt: streamBoards.updatedAt,
      });

    await db.insert(auditEvents).values({
      actorUserId: actor.userId,
      action: "board.assigned",
      entityType: "stream_board",
      requestId: request.headers.get("x-request-id") ?? undefined,
      metadata: { number: boardNumber, matchId: input.matchId, featuredSlot: input.featuredSlot ?? null },
    });

    return apiData({ board });
  } catch (error) {
    return invalidInput(error);
  }
}
