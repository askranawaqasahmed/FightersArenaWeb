import { z } from "zod";
import { apiData, apiProblem, invalidInput, normalizePhone } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { createAdminGamer, listAdminGamers } from "@/lib/admin-gamer-data";
import { loginEmailForHandle } from "@/lib/slug";
import { isSameSiteRequest } from "@/lib/request-origin";

const createSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  handle: z.string().trim().min(2).max(80),
  email: z.email().max(255).optional(),
  password: z.string().min(6).max(128).optional(),
  phone: z.string().trim().min(8).max(24).optional(),
  countryId: z.uuid().nullish(),
  cityId: z.uuid().nullish(),
});

function guard(request: Request) {
  if (!isSameSiteRequest(request)) {
    return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
  }
  return null;
}

export async function GET(request: Request) {
  const actor = await getRequestAdmin(request);
  if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
  return apiData({ gamers: await listAdminGamers() });
}

export async function POST(request: Request) {
  try {
    const denied = guard(request);
    if (denied) return denied;
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");

    const input = createSchema.parse(await request.json());
    let phone: string | null = null;
    if (input.phone) {
      try { phone = normalizePhone(input.phone); }
      catch { return apiProblem(422, "INVALID_PHONE", "Invalid phone number", "Use a valid mobile number, for example 03001234567."); }
    }

    const created = await createAdminGamer({
      displayName: input.displayName,
      handle: input.handle,
      // Default portal login: <gamertag>@fightersarena.com, which the player can change later.
      email: input.email ?? loginEmailForHandle(input.handle),
      password: input.password ?? "123456",
      phone,
      countryId: input.countryId ?? null,
      cityId: input.cityId ?? null,
    }, actor.userId);

    return apiData(created, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
