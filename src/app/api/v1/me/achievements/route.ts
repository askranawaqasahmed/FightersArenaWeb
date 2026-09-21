import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { achievementInputSchema, createOwnAchievement, listOwnAchievements } from "@/lib/achievements";
import { getRequestGamer } from "@/lib/request-auth";

export async function GET(request: Request) {
  const account = await getRequestGamer(request);
  if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
  return apiData({ achievements: await listOwnAchievements(account.userId) });
}

export async function POST(request: Request) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    const input = achievementInputSchema.parse(await request.json());
    const id = await createOwnAchievement(account.userId, input);
    return apiData({ id, achievements: await listOwnAchievements(account.userId) }, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
