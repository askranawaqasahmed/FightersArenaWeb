import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { adminCredentials, auditEvents, roles, userIdentities, userRoles, users } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { getRequestAdmin } from "@/lib/admin-auth-request";
import { hashPassword } from "@/lib/password";
import { isSameSiteRequest } from "@/lib/request-origin";

const requestSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string()
    .min(12, "Password must be at least 12 characters.")
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
});

export async function POST(request: Request) {
  try {
    if (!isSameSiteRequest(request)) return apiProblem(403, "ORIGIN_DENIED", "Access denied", "This request must originate from the admin portal.");
    const actor = await getRequestAdmin(request);
    if (!actor) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "A valid administrator session is required.");
    if (actor.role !== "super_admin") return apiProblem(403, "SUPERADMIN_REQUIRED", "Access denied", "Only the superadmin can create administrator accounts.");

    const input = requestSchema.parse(await request.json());
    const [existingIdentity] = await db.select({ id: userIdentities.id }).from(userIdentities)
      .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, input.email)))
      .limit(1);
    if (existingIdentity) return apiProblem(409, "EMAIL_IN_USE", "Account already exists", "An account already uses this email address.");

    const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "admin")).limit(1);
    if (!adminRole) return apiProblem(500, "ADMIN_ROLE_MISSING", "Configuration error", "The administrator role has not been seeded.");

    const passwordHash = await hashPassword(input.password);
    const account = await db.transaction(async (transaction) => {
      const [user] = await transaction.insert(users).values({ status: "active" }).returning({ id: users.id });
      await transaction.insert(userIdentities).values({
        userId: user.id,
        type: "email",
        normalizedValue: input.email,
        verifiedAt: new Date(),
      });
      await transaction.insert(adminCredentials).values({
        userId: user.id,
        passwordHash,
        createdByUserId: actor.userId,
      });
      await transaction.insert(userRoles).values({ userId: user.id, roleId: adminRole.id, scopeType: "platform" });
      await transaction.insert(auditEvents).values({
        actorUserId: actor.userId,
        action: "admin.created",
        entityType: "user",
        entityId: user.id,
        metadata: { email: input.email, role: "admin" },
      });
      return user;
    });

    return apiData({ id: account.id, email: input.email, role: "admin" }, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
