import { apiData, invalidInput } from "@/lib/api";
import { getPublicTournaments } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return apiData(await getPublicTournaments(), {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } catch (error) {
    return invalidInput(error);
  }
}
