import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { tournamentMedia } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiProblem, invalidInput } from "@/lib/api";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id, mediaId } = await params;
    const tournamentId = z.uuid().parse(id);
    const parsedMediaId = z.uuid().parse(mediaId);

    const [deleted] = await db.delete(tournamentMedia).where(and(
      eq(tournamentMedia.id, parsedMediaId),
      eq(tournamentMedia.tournamentId, tournamentId),
    )).returning({ id: tournamentMedia.id });
    if (!deleted) return apiProblem(404, "MEDIA_NOT_FOUND", "Not found", "The gallery image was not found on this event.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return invalidInput(error);
  }
}
