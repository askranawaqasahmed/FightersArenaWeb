import "server-only";

import { redirect } from "next/navigation";
import { requireGamer } from "@/lib/gamer-auth";

/**
 * Use on every signed-in gamer page except the account settings page itself.
 * Seeded and admin-created accounts start on a password they were given, which is
 * guessable from their public handle, so they must replace it before doing anything else.
 */
export async function requireGamerWithOwnPassword() {
  const account = await requireGamer();
  if (account.mustChangePassword) redirect("/dashboard/settings?first=1");
  return account;
}
