import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { gamerProfiles } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestGamer } from "@/lib/request-auth";
import { withdrawRegistrationTx } from "@/lib/tournament-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account.");
    const { registrationId } = await params;
    const parsedRegistrationId = z.uuid().parse(registrationId);

    const result = await db.transaction(async (tx) => {
      const [profile] = await tx.select({ id: gamerProfiles.id }).from(gamerProfiles).where(eq(gamerProfiles.userId, account.userId)).limit(1);
      if (!profile) return null;
      return withdrawRegistrationTx(tx, { registrationId: parsedRegistrationId, gamerProfileId: profile.id }, { actorUserId: account.userId });
    });
    if (!result) return apiProblem(404, "REGISTRATION_NOT_FOUND", "Not found", "The registration was not found.");
    return apiData(result);
  } catch (error) {
    return invalidInput(error);
  }
}
