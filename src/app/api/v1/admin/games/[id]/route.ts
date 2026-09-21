import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEvents, games } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { listAdminGames } from "@/lib/game-data";
import { slugify } from "@/lib/slug";
import { isSameSiteRequest } from "@/lib/request-origin";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  slug: z.string().trim().min(2).max(80).optional(),
  genre: z.string().trim().min(2).max(80).optional(),
  publisher: z.string().trim().max(120).nullable().optional(),
  teamSize: z.number().int().min(1).max(10).optional(),
  coverGradient: z.string().trim().max(120).optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameSiteRequest(request)) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");

    const { id } = await params;
    const input = patchSchema.parse(await request.json());
    const slug = input.slug ? slugify(input.slug) : undefined;
    if (slug) {
      const [clash] = await db.select({ id: games.id }).from(games)
        .where(and(eq(games.slug, slug), ne(games.id, id))).limit(1);
      if (clash) return apiProblem(409, "GAME_EXISTS", "Game already exists", "Another game already uses that address.");
    }

    const updated = await db.update(games).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.genre !== undefined ? { genre: input.genre } : {}),
      ...(input.publisher !== undefined ? { publisher: input.publisher } : {}),
      ...(input.teamSize !== undefined ? { teamSize: input.teamSize } : {}),
      ...(input.coverGradient !== undefined ? { coverGradient: input.coverGradient } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      updatedAt: new Date(),
    }).where(eq(games.id, id)).returning({ id: games.id, slug: games.slug });

    if (updated.length === 0) return apiProblem(404, "GAME_NOT_FOUND", "Not found", "No game exists with that id.");

    await db.insert(auditEvents).values({
      actorUserId: actor.userId,
      action: input.active === false ? "game.deactivated" : "game.updated",
      entityType: "game",
      entityId: id,
      metadata: { slug: updated[0].slug },
    });
    return apiData({ games: await listAdminGames() });
  } catch (error) {
    return invalidInput(error);
  }
}
