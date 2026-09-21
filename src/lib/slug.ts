import { eq } from "drizzle-orm";
import { gamerProfiles } from "@/db/schema";
import type { db } from "@/db/client";

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const LOGIN_EMAIL_DOMAIN = "fightersarena.com";

/** Default portal login address for a gamer tag, e.g. "Hazz" -> hazz@fightersarena.com */
export function loginEmailForHandle(handle: string) {
  const local = handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${local || "player"}@${LOGIN_EMAIL_DOMAIN}`;
}

type DbOrTransaction = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function uniqueProfileSlug(tx: DbOrTransaction, base: string) {
  const root = slugify(base) || "gamer";
  let candidate = root;
  for (let suffix = 2; ; suffix += 1) {
    const [existing] = await tx.select({ id: gamerProfiles.id }).from(gamerProfiles).where(eq(gamerProfiles.slug, candidate)).limit(1);
    if (!existing) return candidate;
    if (suffix > 50) return `${root}-${crypto.randomUUID().slice(0, 8)}`;
    candidate = `${root}-${suffix}`;
  }
}
