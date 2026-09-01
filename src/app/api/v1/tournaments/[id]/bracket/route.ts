import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getPublicBracket, resolvePublicSlug } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const slug = await resolvePublicSlug((await params).id);
    const divisionId = new URL(request.url).searchParams.get("division") ?? undefined;
    const view = slug ? await getPublicBracket(slug, divisionId) : null;
    if (!view) {
      return apiProblem(404, "BRACKET_NOT_FOUND", "Not found", "No public bracket matches this tournament or competition.");
    }
    const etag = `"${view.version}"`;
    const headers = {
      etag,
      "cache-control": "no-store, must-revalidate",
      "access-control-allow-origin": "*",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    return apiData(view, { headers });
  } catch (error) {
    return invalidInput(error);
  }
}
