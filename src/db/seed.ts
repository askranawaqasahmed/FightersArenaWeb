import { and, eq } from "drizzle-orm";
import { db, sqlClient } from "./client";
import {
  adminCredentials,
  countries,
  cities,
  permissions,
  roles,
  userIdentities,
  userRoles,
  users,
} from "./schema";
import { hashPassword } from "@/lib/password";
import { referenceIds } from "./seed-data/ids";

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@fightersarena.com";

function requireSuperadminPassword(): string {
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required to seed the superadmin account.");
  }
  return password;
}

const SUPERADMIN_PASSWORD = requireSuperadminPassword();

async function seed() {
  await db.insert(countries).values({ id: referenceIds.pakistan, iso2: "PK", name: "Pakistan", phoneCode: "+92" }).onConflictDoNothing();
  await db.insert(cities).values([
    { id: referenceIds.karachi, countryId: referenceIds.pakistan, name: "Karachi", regionName: "Sindh", timeZone: "Asia/Karachi" },
    { id: referenceIds.lahore, countryId: referenceIds.pakistan, name: "Lahore", regionName: "Punjab", timeZone: "Asia/Karachi" },
    { id: referenceIds.islamabad, countryId: referenceIds.pakistan, name: "Islamabad", regionName: "Islamabad Capital Territory", timeZone: "Asia/Karachi" },
  ]).onConflictDoNothing();

  await db.insert(roles).values([
    { key: "super_admin", name: "Super Admin" },
    { key: "admin", name: "Admin" },
    { key: "tournament_operator", name: "Tournament Operator" },
    { key: "content_manager", name: "Content Manager" },
    { key: "gamer", name: "Gamer" },
    { key: "sponsor", name: "Sponsor Representative" },
  ]).onConflictDoNothing();

  await db.insert(permissions).values([
    { key: "platform.manage", description: "Manage platform settings and access" },
    { key: "tournament.manage", description: "Configure and operate tournaments" },
    { key: "match.result.write", description: "Report and finalize match results" },
    { key: "content.publish", description: "Publish homepage and editorial content" },
    { key: "identity.verify", description: "Verify gamers, teams, and sponsors" },
    { key: "audit.read", description: "Review audit events" },
  ]).onConflictDoNothing();

  const [superAdminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, "super_admin")).limit(1);
  if (!superAdminRole) throw new Error("super_admin role missing after seeding roles.");

  const [existingSuperAdminIdentity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(and(eq(userIdentities.type, "email"), eq(userIdentities.normalizedValue, SUPERADMIN_EMAIL)))
    .limit(1);

  const superAdminUserId = existingSuperAdminIdentity?.userId ?? referenceIds.superAdmin;
  await db.insert(users).values({ id: superAdminUserId, status: "active", acceptedTermsVersion: "2026-08" })
    .onConflictDoUpdate({ target: users.id, set: { status: "active" } });
  await db.insert(userIdentities).values({
    userId: superAdminUserId,
    type: "email",
    normalizedValue: SUPERADMIN_EMAIL,
    verifiedAt: new Date(),
  }).onConflictDoNothing();

  // Insert-only: a re-run must never reset a password the superadmin has changed.
  await db.insert(adminCredentials).values({
    userId: superAdminUserId,
    passwordHash: await hashPassword(SUPERADMIN_PASSWORD),
  }).onConflictDoNothing();

  await db.insert(userRoles).values({ userId: superAdminUserId, roleId: superAdminRole.id, scopeType: "platform" }).onConflictDoNothing();
}

seed()
  .then(() => console.log("Reference data seeded."))
  .finally(() => sqlClient.end());
