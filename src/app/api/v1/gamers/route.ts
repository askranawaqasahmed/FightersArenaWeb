import { apiData, invalidInput } from "@/lib/api";
import { getPublicGamers } from "@/lib/public-gamer-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const game = url.searchParams.get("game");
    const city = url.searchParams.get("city");
    let gamers = await getPublicGamers();
    if (game) gamers = gamers.filter((gamer) => gamer.game === game);
    if (city) gamers = gamers.filter((gamer) => gamer.city === city);
    return apiData(gamers, {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } catch (error) {
    return invalidInput(error);
  }
}
