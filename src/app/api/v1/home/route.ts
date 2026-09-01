import { apiData, invalidInput } from "@/lib/api";
import { getHomeFeed } from "@/lib/home-feed";

export async function GET() {
  try {
    const feed = await getHomeFeed();
    const response = apiData(feed);
    response.headers.set("cache-control", "public, max-age=30");
    return response;
  } catch (error) {
    return invalidInput(error);
  }
}
