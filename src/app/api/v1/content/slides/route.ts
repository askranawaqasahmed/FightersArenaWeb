import { apiData, invalidInput } from "@/lib/api";
import { getPublishedSlides } from "@/lib/content-slides";

export async function GET() {
  try {
    return apiData({ slides: await getPublishedSlides() });
  } catch (error) {
    return invalidInput(error);
  }
}
