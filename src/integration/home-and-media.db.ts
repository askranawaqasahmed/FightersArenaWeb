import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { homepageSlides, mediaAssets, tournamentMedia, tournaments, users } from "@/db/schema";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("home content and tournament media against PostgreSQL", () => {
  it("filters slides by publish state and schedule window", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const now = new Date();
        const past = new Date(now.getTime() - 86_400_000);
        const future = new Date(now.getTime() + 86_400_000);
        await tx.insert(homepageSlides).values([
          { title: `Visible now ${suffix}`, published: true, sequence: 1 },
          { title: `Windowed visible ${suffix}`, published: true, sequence: 2, startsAt: past, endsAt: future },
          { title: `Draft hidden ${suffix}`, published: false, sequence: 3 },
          { title: `Expired hidden ${suffix}`, published: true, sequence: 4, endsAt: past },
          { title: `Not yet visible ${suffix}`, published: true, sequence: 5, startsAt: future },
        ]);

        const visible = await tx.select({ title: homepageSlides.title }).from(homepageSlides).where(and(
          eq(homepageSlides.published, true),
          or(isNull(homepageSlides.startsAt), lte(homepageSlides.startsAt, now)),
          or(isNull(homepageSlides.endsAt), gte(homepageSlides.endsAt, now)),
        )).orderBy(asc(homepageSlides.sequence));
        const titles = visible.map((slide) => slide.title).filter((title) => title.includes(suffix));
        expect(titles).toEqual([`Visible now ${suffix}`, `Windowed visible ${suffix}`]);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });

  it("links uploaded media to a tournament gallery exactly once", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const [admin] = await tx.insert(users).values({ status: "active" }).returning();
        const [event] = await tx.insert(tournaments).values({
          slug: `gallery-event-${suffix}`,
          name: "Gallery validation event",
          status: "completed",
        }).returning();
        const [asset] = await tx.insert(mediaAssets).values({
          ownerUserId: admin.id,
          objectKey: `event-gallery/2026-08-21/${suffix}.webp`,
          mimeType: "image/webp",
          sizeBytes: 1024,
          altText: "Winners on stage",
          moderationStatus: "approved",
        }).returning();

        const [link] = await tx.insert(tournamentMedia).values({
          tournamentId: event.id,
          mediaAssetId: asset.id,
          caption: "Trophy lift",
          sequence: 1,
          createdByUserId: admin.id,
        }).returning();
        expect(link.tournamentId).toBe(event.id);

        // The unique index refuses a duplicate link of the same asset to the same event.
        await expect(tx.insert(tournamentMedia).values({
          tournamentId: event.id,
          mediaAssetId: asset.id,
        })).rejects.toThrow();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
