import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getOwnProfile, upsertOwnProfile } from "@/lib/me-data";
import { getRequestGamer } from "@/lib/request-auth";

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(100).optional(),
  handle: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  countryId: z.uuid().nullable().optional(),
  cityId: z.uuid().nullable().optional(),
  profileVisibility: z.enum(["private", "sponsors", "public"]).optional(),
});

export async function GET(request: Request) {
  const account = await getRequestGamer(request);
  if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
  return apiData({ profile: await getOwnProfile(account.userId) });
}

export async function PATCH(request: Request) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    const patch = patchSchema.parse(await request.json());
    await upsertOwnProfile(account.userId, patch);
    return apiData({ profile: await getOwnProfile(account.userId) });
  } catch (error) {
    return invalidInput(error);
  }
}
