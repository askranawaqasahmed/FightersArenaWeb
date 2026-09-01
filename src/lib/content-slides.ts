import { and, asc, eq, isNull, lte, gte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { homepageSlides } from "@/db/schema";

export const slideBodySchema = z.object({
  eyebrow: z.string().trim().max(80).nullish(),
  title: z.string().trim().min(1).max(180),
  summary: z.string().trim().max(2000).nullish(),
  imageUrl: z.string().trim().max(2048).nullish(),
  imageAlt: z.string().trim().max(500).nullish(),
  ctaLabel: z.string().trim().max(60).nullish(),
  ctaUrl: z.string().trim().max(2048).nullish(),
  sequence: z.number().int().min(0).max(10_000).optional(),
  published: z.boolean().optional(),
  startsAt: z.iso.datetime().nullish(),
  endsAt: z.iso.datetime().nullish(),
});

export function slideResponse(row: typeof homepageSlides.$inferSelect) {
  return {
    id: row.id,
    eyebrow: row.eyebrow,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    ctaLabel: row.callToActionLabel,
    ctaUrl: row.callToActionUrl,
    sequence: row.sequence,
    published: row.published,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type PublicSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sequence: number;
};

export async function getPublishedSlides(): Promise<PublicSlide[]> {
  const now = new Date();
  const rows = await db.select().from(homepageSlides).where(and(
    eq(homepageSlides.published, true),
    or(isNull(homepageSlides.startsAt), lte(homepageSlides.startsAt, now)),
    or(isNull(homepageSlides.endsAt), gte(homepageSlides.endsAt, now)),
  )).orderBy(asc(homepageSlides.sequence), asc(homepageSlides.createdAt));
  return rows.map((row) => ({
    id: row.id,
    eyebrow: row.eyebrow,
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    ctaLabel: row.callToActionLabel,
    ctaUrl: row.callToActionUrl,
    sequence: row.sequence,
  }));
}
