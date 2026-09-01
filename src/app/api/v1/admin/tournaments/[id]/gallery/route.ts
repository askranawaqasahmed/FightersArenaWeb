import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mediaAssets, tournamentMedia, tournaments } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { mediaUrlForKey } from "@/lib/object-storage";

const createSchema = z.object({
  key: z.string().min(1).max(1024),
  caption: z.string().trim().max(500).nullish(),
  sequence: z.number().int().min(0).max(10_000).optional(),
});

async function findTournament(id: string) {
  const tournamentId = z.uuid().parse(id);
  const [tournament] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  return tournament ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id } = await params;
    const tournament = await findTournament(id);
    if (!tournament) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");

    const rows = await db.select({
      id: tournamentMedia.id,
      caption: tournamentMedia.caption,
      sequence: tournamentMedia.sequence,
      createdAt: tournamentMedia.createdAt,
      objectKey: mediaAssets.objectKey,
      mimeType: mediaAssets.mimeType,
      sizeBytes: mediaAssets.sizeBytes,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
    }).from(tournamentMedia)
      .innerJoin(mediaAssets, eq(mediaAssets.id, tournamentMedia.mediaAssetId))
      .where(eq(tournamentMedia.tournamentId, tournament.id))
      .orderBy(asc(tournamentMedia.sequence), asc(tournamentMedia.createdAt));
    return apiData({
      images: rows.map((row) => ({
        id: row.id,
        url: mediaUrlForKey(row.objectKey),
        caption: row.caption,
        altText: row.altText,
        sequence: row.sequence,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        uploadedAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return invalidInput(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { id } = await params;
    const tournament = await findTournament(id);
    if (!tournament) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");
    const input = createSchema.parse(await request.json());

    const [asset] = await db.select({ id: mediaAssets.id, objectKey: mediaAssets.objectKey })
      .from(mediaAssets).where(eq(mediaAssets.objectKey, input.key)).limit(1);
    if (!asset) return apiProblem(404, "MEDIA_NOT_FOUND", "Not found", "Upload the file first, then link it to the event.");

    const [existing] = await db.select({ id: tournamentMedia.id }).from(tournamentMedia)
      .where(eq(tournamentMedia.mediaAssetId, asset.id)).limit(1);
    if (existing) return apiProblem(409, "MEDIA_ALREADY_LINKED", "Already linked", "This image is already part of an event gallery.");

    const [created] = await db.insert(tournamentMedia).values({
      tournamentId: tournament.id,
      mediaAssetId: asset.id,
      caption: input.caption ?? null,
      sequence: input.sequence ?? 0,
      createdByUserId: actor.userId,
    }).returning({ id: tournamentMedia.id, caption: tournamentMedia.caption, sequence: tournamentMedia.sequence, createdAt: tournamentMedia.createdAt });
    return apiData({
      image: {
        id: created.id,
        url: mediaUrlForKey(asset.objectKey),
        caption: created.caption,
        sequence: created.sequence,
        uploadedAt: created.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
