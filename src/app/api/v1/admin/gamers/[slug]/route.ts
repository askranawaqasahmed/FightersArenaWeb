import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { getAdminGamer, updateAdminGamer } from "@/lib/admin-gamer-data";
import { achievementCategories } from "@/lib/achievement-labels";
import { isSameSiteRequest } from "@/lib/request-origin";

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  handle: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  cityId: z.uuid().nullable().optional(),
  countryId: z.uuid().nullable().optional(),
  profileVisibility: z.enum(["private", "sponsors", "public"]).optional(),
  verificationStatus: z.enum(["unverified", "pending", "verified", "rejected"]).optional(),
  rankingPoints: z.number().int().min(0).max(1_000_000).optional(),
  games: z.array(z.object({
    gameId: z.uuid(),
    inGameName: z.string().trim().min(1).max(100),
    primaryRole: z.string().trim().max(80).nullish(),
    platform: z.string().trim().max(64).nullish(),
  })).max(40).optional(),
  achievements: z.array(z.object({
    category: z.enum(achievementCategories),
    title: z.string().trim().min(2).max(200),
    detail: z.string().trim().max(2000).nullish(),
    gameId: z.uuid().nullish(),
    yearLabel: z.string().trim().max(40).nullish(),
  })).max(100).optional(),
});

const notFound = () => apiProblem(404, "GAMER_NOT_FOUND", "Not found", "No player exists with that profile address.");

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const actor = await getRequestAdmin(request);
  if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
  const gamer = await getAdminGamer((await params).slug);
  if (!gamer) return notFound();
  return apiData({ gamer });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!isSameSiteRequest(request)) {
      return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    }
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const { slug } = await params;
    const patch = patchSchema.parse(await request.json());
    if (!(await updateAdminGamer(slug, patch, actor.userId))) return notFound();
    return apiData({ gamer: await getAdminGamer(slug) });
  } catch (error) {
    return invalidInput(error);
  }
}
