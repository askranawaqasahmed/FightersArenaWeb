import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { homepageSlides } from "@/db/schema";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { slideBodySchema, slideResponse } from "@/lib/content-slides";

const patchSchema = slideBodySchema.partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ slideId: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { slideId } = await params;
    const parsedSlideId = z.uuid().parse(slideId);
    const input = patchSchema.parse(await request.json());

    const changes = {
      ...(input.eyebrow !== undefined ? { eyebrow: input.eyebrow ?? null } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary ?? null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
      ...(input.imageAlt !== undefined ? { imageAlt: input.imageAlt ?? null } : {}),
      ...(input.ctaLabel !== undefined ? { callToActionLabel: input.ctaLabel ?? null } : {}),
      ...(input.ctaUrl !== undefined ? { callToActionUrl: input.ctaUrl ?? null } : {}),
      ...(input.sequence !== undefined ? { sequence: input.sequence } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
      ...(input.startsAt !== undefined ? { startsAt: input.startsAt ? new Date(input.startsAt) : null } : {}),
      ...(input.endsAt !== undefined ? { endsAt: input.endsAt ? new Date(input.endsAt) : null } : {}),
    };
    if (Object.keys(changes).length === 0) {
      return apiProblem(422, "EMPTY_PATCH", "Nothing to update", "Provide at least one field to change.");
    }

    const [updated] = await db.update(homepageSlides)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(homepageSlides.id, parsedSlideId))
      .returning();
    if (!updated) return apiProblem(404, "SLIDE_NOT_FOUND", "Not found", "The slide was not found.");
    return apiData({ slide: slideResponse(updated) });
  } catch (error) {
    return invalidInput(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slideId: string }> }) {
  try {
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { slideId } = await params;
    const parsedSlideId = z.uuid().parse(slideId);
    const [deleted] = await db.delete(homepageSlides).where(eq(homepageSlides.id, parsedSlideId)).returning({ id: homepageSlides.id });
    if (!deleted) return apiProblem(404, "SLIDE_NOT_FOUND", "Not found", "The slide was not found.");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return invalidInput(error);
  }
}
