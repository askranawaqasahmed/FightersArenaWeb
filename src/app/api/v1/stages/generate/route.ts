import { z } from "zod";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { generateDoubleElimination, generateRoundRobin, generateSingleElimination, validateBracket } from "@/domain/tournament-engine";

const requestSchema = z.object({
  format: z.enum(["round_robin", "single_elimination", "double_elimination"]),
  participants: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(140), seed: z.number().int().positive() })).min(2).max(128),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)]).default(3),
  legs: z.union([z.literal(1), z.literal(2)]).default(1),
  grandFinalReset: z.boolean().default(false),
}).superRefine((value, context) => {
  const seeds = new Set(value.participants.map((participant) => participant.seed));
  if (seeds.size !== value.participants.length) context.addIssue({ code: "custom", path: ["participants"], message: "Participant seeds must be unique." });
});

export async function POST(request: Request) {
  try {
    const identity = await getRequestAdmin(request);
    if (!identity) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    const input = requestSchema.parse(await request.json());
    if (input.format === "round_robin") return apiData({ format: input.format, fixtures: generateRoundRobin(input.participants, input.legs), validationErrors: [] });
    const bracket = input.format === "single_elimination"
      ? generateSingleElimination(input.participants, { bestOf: input.bestOf })
      : generateDoubleElimination(input.participants, { bestOf: input.bestOf, grandFinalReset: input.grandFinalReset });
    return apiData({ ...bracket, validationErrors: validateBracket(bracket) });
  } catch (error) {
    return invalidInput(error);
  }
}
