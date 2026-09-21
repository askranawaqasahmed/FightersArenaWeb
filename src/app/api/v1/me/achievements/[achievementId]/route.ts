import { apiData, apiProblem, invalidInput } from "@/lib/api";
import {
  achievementInputSchema,
  deleteOwnAchievement,
  listOwnAchievements,
  updateOwnAchievement,
} from "@/lib/achievements";
import { getRequestGamer } from "@/lib/request-auth";

const notFound = () => apiProblem(404, "ACHIEVEMENT_NOT_FOUND", "Not found", "This achievement is not on your profile.");

export async function PATCH(request: Request, { params }: { params: Promise<{ achievementId: string }> }) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    const { achievementId } = await params;
    const input = achievementInputSchema.parse(await request.json());
    if (!(await updateOwnAchievement(account.userId, achievementId, input))) return notFound();
    return apiData({ achievements: await listOwnAchievements(account.userId) });
  } catch (error) {
    return invalidInput(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ achievementId: string }> }) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    const { achievementId } = await params;
    if (!(await deleteOwnAchievement(account.userId, achievementId))) return notFound();
    return apiData({ achievements: await listOwnAchievements(account.userId) });
  } catch (error) {
    return invalidInput(error);
  }
}
