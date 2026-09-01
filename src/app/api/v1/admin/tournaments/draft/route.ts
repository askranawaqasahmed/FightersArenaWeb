import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { saveTournamentDraftToDatabase } from "@/lib/admin-tournament-draft";

const stageSchema = z.object({
  id: z.string().min(1),
  format: z.enum(["groups", "single-elimination", "double-elimination"]),
  groups: z.number().int().min(1).max(16),
  advancePerGroup: z.number().int().min(1),
  bestOf: z.union([z.literal(3), z.literal(5), z.literal(7)]),
  grandFinalReset: z.boolean(),
});
const competitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  gameSlug: z.string().trim().min(1).max(80),
  competitionType: z.enum(["tournament", "league"]),
  maxEntries: z.number().int().min(2),
  registrationRestricted: z.boolean(),
  registrationLimit: z.number().int().min(2),
  leagueTeamCount: z.number().int().min(2),
  playersPerTeam: z.number().int().min(1),
  leagueTeams: z.array(z.object({ id: z.string(), name: z.string(), leaderId: z.string(), playerIds: z.array(z.string()) })),
  stages: z.array(stageSchema).min(1),
});
const draftSchema = z.object({
  slug: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(180),
  description: z.string(),
  imageUrl: z.string(),
  imageAlt: z.string(),
  startsAt: z.iso.date(),
  endsAt: z.iso.date(),
  location: z.string().trim().min(1),
  attachments: z.array(z.object({ key: z.string(), url: z.string(), name: z.string(), mimeType: z.string(), sizeBytes: z.number() })),
  competitions: z.array(competitionSchema).min(1),
});

export async function PUT(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const draft = draftSchema.parse(await request.json());
    return apiData(await saveTournamentDraftToDatabase(draft, { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined }));
  } catch (error) {
    return invalidInput(error);
  }
}
