import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { auditEvents, games } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { listAdminGames } from "@/lib/game-data";
import { slugify } from "@/lib/slug";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(80).optional(),
  genre: z.string().trim().min(2).max(80).default("Fighting"),
  publisher: z.string().trim().max(120).nullish(),
  teamSize: z.number().int().min(1).max(10).default(1),
  coverGradient: z.string().trim().max(120).default("green"),
  imageUrl: z.string().trim().max(2000).nullish(),
  active: z.boolean().default(true),
});

export async function GET(request: Request) {
  const actor = await getRequestAdmin(request);
  if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
  return apiData({ games: await listAdminGames() });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");

    const input = createSchema.parse(await request.json());
    const slug = slugify(input.slug ?? input.name);
    const [existing] = await db.select({ id: games.id }).from(games).where(eq(games.slug, slug)).limit(1);
    if (existing) return apiProblem(409, "GAME_EXISTS", "Game already exists", "A game already uses that address.");

    const [created] = await db.insert(games).values({
      slug,
      name: input.name,
      genre: input.genre,
      publisher: input.publisher ?? null,
      teamSize: input.teamSize,
      coverGradient: input.coverGradient,
      imageUrl: input.imageUrl ?? null,
      active: input.active,
    }).returning({ id: games.id, slug: games.slug });

    await db.insert(auditEvents).values({
      actorUserId: actor.userId,
      action: "game.created",
      entityType: "game",
      entityId: created.id,
      metadata: { slug: created.slug, name: input.name },
    });
    return apiData({ game: created, games: await listAdminGames() }, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
