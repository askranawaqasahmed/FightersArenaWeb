import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { homepageSlides } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { slideBodySchema, slideResponse } from "@/lib/content-slides";

export async function GET(request: Request) {
  const actor = await getRequestAdmin(request);
  if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
  const rows = await db.select().from(homepageSlides).orderBy(asc(homepageSlides.sequence), asc(homepageSlides.createdAt));
  return apiData({ slides: rows.map(slideResponse) });
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const input = slideBodySchema.parse(await request.json());
    const [created] = await db.insert(homepageSlides).values({
      eyebrow: input.eyebrow ?? null,
      title: input.title,
      summary: input.summary ?? null,
      imageUrl: input.imageUrl ?? null,
      imageAlt: input.imageAlt ?? null,
      callToActionLabel: input.ctaLabel ?? null,
      callToActionUrl: input.ctaUrl ?? null,
      sequence: input.sequence ?? 0,
      published: input.published ?? false,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    }).returning();
    return apiData({ slide: slideResponse(created) }, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
