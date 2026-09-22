/**
 * Reframes Kashif Yagami's "players developed" entries.
 *
 * They were seeded as one row per person, with the player's name as the title and
 * their placement underneath. That publishes other competitors' results on someone
 * else's profile; his own career profile document describes the contribution instead,
 * "without focusing on individual player profiles". This replaces those rows with the
 * four themes from that document.
 *
 * One-off and idempotent: it only touches rows whose titles match the original set, so
 * a second run does nothing, and it never touches the coaching rows, which legitimately
 * name the players and teams he coached.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, sqlClient } from "./client";
import { gamerAchievements, gamerProfiles } from "./schema";
import { seedId } from "./seed-data/ids";
import { seedGamers } from "./seed-data/gamers";

const NAMED_TITLES = ["MehtabKai", "KamranBilly", "HammadKhan", "Farhan"];

async function run() {
  const [kashif] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles)
    .where(eq(gamerProfiles.slug, "kashif-yagami")).limit(1);
  if (!kashif) {
    console.log("kashif-yagami not found; nothing to do.");
    return;
  }

  const removed = await db.delete(gamerAchievements).where(and(
    eq(gamerAchievements.gamerId, kashif.id),
    eq(gamerAchievements.category, "player_developed"),
    inArray(gamerAchievements.title, NAMED_TITLES),
  )).returning({ title: gamerAchievements.title });
  console.log(`Removed ${removed.length} name-based rows.`);

  const seeded = seedGamers.find((entry) => entry.slug === "kashif-yagami");
  if (!seeded) throw new Error("kashif-yagami missing from the seed data.");
  const lane = seedGamers.findIndex((entry) => entry.slug === "kashif-yagami") + 1;

  // Re-insert the full achievement set at its seeded ids; conflicts mean the row is
  // already correct, so the rest of his achievements are left untouched.
  const rows = seeded.achievements.map((achievement, index) => ({
    id: seedId(4001 + index, lane),
    gamerId: kashif.id,
    category: achievement.category,
    title: achievement.title,
    detail: achievement.detail ?? null,
    yearLabel: achievement.yearLabel ?? null,
    sequence: index,
    verified: true,
  }));
  await db.insert(gamerAchievements).values(rows).onConflictDoUpdate({
    target: gamerAchievements.id,
    set: {
      category: sql`excluded.category`,
      title: sql`excluded.title`,
      detail: sql`excluded.detail`,
      sequence: sql`excluded.sequence`,
    },
  });

  const after = await db.select({ title: gamerAchievements.title, category: gamerAchievements.category })
    .from(gamerAchievements).where(eq(gamerAchievements.gamerId, kashif.id));
  console.log(`${after.filter((r) => r.category === "player_developed").length} development rows, ${after.filter((r) => r.category === "coaching").length} coaching rows.`);
}

run()
  .then(() => console.log("Done."))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => sqlClient.end());
