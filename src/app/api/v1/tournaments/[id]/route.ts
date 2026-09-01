import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getPublicTournament, resolvePublicSlug } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = await resolvePublicSlug((await params).id);
    const detail = slug ? await getPublicTournament(slug) : null;
    if (!detail) {
      return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "No public tournament matches this identifier.");
    }
    return apiData(detail, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } catch (error) {
    return invalidInput(error);
  }
}
