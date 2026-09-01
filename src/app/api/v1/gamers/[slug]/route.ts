import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getPublicGamer } from "@/lib/public-gamer-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const profile = await getPublicGamer((await params).slug);
    if (!profile) {
      return apiProblem(404, "GAMER_NOT_FOUND", "Not found", "No public player profile matches this slug.");
    }
    return apiData(profile, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } catch (error) {
    return invalidInput(error);
  }
}
