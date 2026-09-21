import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { saveTournamentDraftToDatabase } from "@/lib/admin-tournament-draft";
import { isSameSiteRequest } from "@/lib/request-origin";

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
  stages: z.array(stageSchema),
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
  hasBracket: z.boolean().default(true),
  youtubeUrl: z.string().trim().max(500).default(""),
  attachments: z.array(z.object({ key: z.string(), url: z.string(), name: z.string(), mimeType: z.string(), sizeBytes: z.number() })),
  competitions: z.array(competitionSchema).min(1),
}).superRefine((draft, context) => {
  // A bracket event still needs at least one stage per competition; a recorded
  // result keeps none, because there are no matches to generate.
  if (!draft.hasBracket) return;
  draft.competitions.forEach((competition, index) => {
    if (competition.stages.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["competitions", index, "stages"],
        message: `${competition.name} must contain at least one stage.`,
      });
    }
  });
});

export async function PUT(request: Request) {
  try {
    if (!isSameSiteRequest(request)) return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const draft = draftSchema.parse(await request.json());
    return apiData(await saveTournamentDraftToDatabase(draft, { actorUserId: actor.userId, requestId: request.headers.get("x-request-id") ?? undefined }));
  } catch (error) {
    return invalidInput(error);
  }
}
