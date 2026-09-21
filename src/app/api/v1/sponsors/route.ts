import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sponsors, sponsorships } from "@/db/schema";
import { apiData, apiProblem } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db.select({
      id: sponsors.id,
      slug: sponsors.slug,
      name: sponsors.name,
      category: sponsors.category,
      websiteUrl: sponsors.websiteUrl,
      logoUrl: sponsors.logoUrl,
      verificationStatus: sponsors.verificationStatus,
    }).from(sponsors).orderBy(asc(sponsors.name));

    const partnerships = await db.select({ sponsorId: sponsorships.sponsorId, value: count() })
      .from(sponsorships)
      .where(and(eq(sponsorships.public, true), inArray(sponsorships.status, ["accepted", "active"])))
      .groupBy(sponsorships.sponsorId);
    const countBySponsor = new Map(partnerships.map((row) => [row.sponsorId, Number(row.value)]));

    return apiData(rows.map((row) => ({
      ...row,
      verified: row.verificationStatus === "verified",
      publicPartnerships: countBySponsor.get(row.id) ?? 0,
    })));
  } catch {
    return apiProblem(503, "DATABASE_UNAVAILABLE", "Service unavailable", "The sponsor directory is temporarily unavailable.");
  }
}
