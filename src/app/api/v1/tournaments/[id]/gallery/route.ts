import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { mediaAssets, tournamentMedia, tournaments } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { mediaUrlForKey } from "@/lib/object-storage";
import { publicTournamentStatuses, resolveTournamentId } from "@/lib/public-tournament-data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tournamentId = await resolveTournamentId(id);
    if (!tournamentId) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");
    const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(and(
      eq(tournaments.id, tournamentId),
      inArray(tournaments.status, [...publicTournamentStatuses]),
    )).limit(1);
    if (!tournament) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");

    const rows = await db.select({
      id: tournamentMedia.id,
      caption: tournamentMedia.caption,
      sequence: tournamentMedia.sequence,
      createdAt: tournamentMedia.createdAt,
      objectKey: mediaAssets.objectKey,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
    }).from(tournamentMedia)
      .innerJoin(mediaAssets, eq(mediaAssets.id, tournamentMedia.mediaAssetId))
      .where(eq(tournamentMedia.tournamentId, tournamentId))
      .orderBy(asc(tournamentMedia.sequence), asc(tournamentMedia.createdAt));
    return apiData({
      images: rows.map((row) => ({
        id: row.id,
        url: mediaUrlForKey(row.objectKey),
        caption: row.caption,
        altText: row.altText,
        width: row.width,
        height: row.height,
        sequence: row.sequence,
        uploadedAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return invalidInput(error);
  }
}
