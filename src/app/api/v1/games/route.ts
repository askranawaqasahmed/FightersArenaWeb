import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { games } from "@/db/schema";
import { apiData, apiProblem } from "@/lib/api";

export async function GET() {
  try {
    const data = await db.select({
      id: games.id,
      slug: games.slug,
      name: games.name,
      genre: games.genre,
      publisher: games.publisher,
      teamSize: games.teamSize,
      imageUrl: games.imageUrl,
    }).from(games).where(eq(games.active, true)).orderBy(asc(games.name));
    return apiData(data);
  } catch {
    return apiProblem(503, "DATABASE_UNAVAILABLE", "Service unavailable", "The game catalog is temporarily unavailable.");
  }
}
