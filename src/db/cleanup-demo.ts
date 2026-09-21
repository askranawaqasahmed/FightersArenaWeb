/**
 * Removes the demo/dummy rows the original seed created, by exact slug and id.
 * Never truncates, and never touches roles, permissions, countries, cities,
 * any admin account, or any record created from the admin portal.
 *
 *   npm run db:cleanup-demo            dry run, prints what would be removed
 *   npm run db:cleanup-demo -- --apply actually deletes
 */
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, sqlClient } from "./client";
import {
  adminCredentials,
  auditEvents,
  divisions,
  games,
  gamerProfiles,
  homepageSlides,
  mediaAssets,
  registrations,
  sponsors,
  sponsorships,
  stageParticipants,
  standings,
  tournamentParticipantSnapshots,
  tournaments,
  userIdentities,
  users,
} from "./schema";
import {
  demoGamerPhone,
  demoGamerSlug,
  demoGameSlugs,
  demoIds,
  demoSlideTitle,
  demoSponsorSlugs,
  demoTournamentSlugs,
} from "./seed-data/ids";

const apply = process.argv.includes("--apply");

function report(label: string, count: number) {
  console.log(`${apply ? "removed" : "would remove"} ${count} ${label}`);
}

async function cleanup() {
  await db.transaction(async (tx) => {
    // 1. Demo homepage slide (table has no unique key, so match on title + CTA).
    const slides = await tx.select({ id: homepageSlides.id }).from(homepageSlides)
      .where(and(
        eq(homepageSlides.title, demoSlideTitle),
        eq(homepageSlides.callToActionUrl, `/tournaments/${demoTournamentSlugs[0]}`),
      ));
    if (apply && slides.length) {
      await tx.delete(homepageSlides).where(inArray(homepageSlides.id, slides.map((slide) => slide.id)));
    }
    report("homepage slide(s)", slides.length);

    // 2. Demo tournaments — cascades to divisions, registrations, stages, standings, snapshots.
    const demoTournaments = await tx.select({ id: tournaments.id }).from(tournaments)
      .where(or(
        inArray(tournaments.slug, [...demoTournamentSlugs]),
        inArray(tournaments.id, [demoIds.national, demoIds.proLeague]),
      ));
    if (apply && demoTournaments.length) {
      await tx.delete(tournaments).where(inArray(tournaments.id, demoTournaments.map((row) => row.id)));
    }
    report("demo tournament(s)", demoTournaments.length);

    // 3. Demo gamer NOVA — only when it is not an admin account.
    const [demoGamer] = await tx.select({ userId: users.id, profileId: gamerProfiles.id })
      .from(gamerProfiles)
      .innerJoin(users, eq(users.id, gamerProfiles.userId))
      .leftJoin(adminCredentials, eq(adminCredentials.userId, users.id))
      .where(and(
        eq(gamerProfiles.slug, demoGamerSlug),
        isNull(adminCredentials.userId),
        or(
          eq(users.id, demoIds.gamerUser),
          sql`exists (select 1 from ${userIdentities} ui where ui.user_id = ${users.id} and ui.type = 'phone' and ui.normalized_value = ${demoGamerPhone})`,
        ),
      ))
      .limit(1);

    if (demoGamer && apply) {
      // Polymorphic rows have no FK, so clear them by participant id first.
      await tx.delete(registrations).where(eq(registrations.participantId, demoGamer.profileId));
      await tx.delete(tournamentParticipantSnapshots).where(eq(tournamentParticipantSnapshots.participantId, demoGamer.profileId));
      await tx.delete(standings).where(eq(standings.participantId, demoGamer.profileId));
      await tx.delete(stageParticipants).where(eq(stageParticipants.participantId, demoGamer.profileId));
      await tx.delete(sponsorships).where(eq(sponsorships.subjectId, demoGamer.profileId));
      // These FKs do not cascade and would block the delete.
      await tx.update(mediaAssets).set({ ownerUserId: null }).where(eq(mediaAssets.ownerUserId, demoGamer.userId));
      await tx.update(auditEvents).set({ actorUserId: null }).where(eq(auditEvents.actorUserId, demoGamer.userId));
      await tx.delete(users).where(eq(users.id, demoGamer.userId));
    }
    report("demo gamer account(s)", demoGamer ? 1 : 0);

    // 4. Demo games — only when nothing references them any more.
    const demoGames = await tx.select({ id: games.id, slug: games.slug }).from(games)
      .where(inArray(games.slug, [...demoGameSlugs]));
    const removableGames: string[] = [];
    for (const game of demoGames) {
      const [used] = await tx.select({ id: divisions.id }).from(divisions).where(eq(divisions.gameId, game.id)).limit(1);
      if (used) console.warn(`  keeping game "${game.slug}": still used by a tournament division`);
      else removableGames.push(game.id);
    }
    if (apply && removableGames.length) {
      await tx.delete(games).where(inArray(games.id, removableGames));
    }
    report("demo game(s)", removableGames.length);

    // 5. Demo sponsors — cascades to sponsorships.
    const demoSponsors = await tx.select({ id: sponsors.id }).from(sponsors)
      .where(inArray(sponsors.slug, [...demoSponsorSlugs]));
    if (apply && demoSponsors.length) {
      await tx.delete(sponsors).where(inArray(sponsors.id, demoSponsors.map((row) => row.id)));
    }
    report("demo sponsor(s)", demoSponsors.length);

    // 6. Warn about games the tournament builder auto-created before that behaviour was removed.
    const suspicious = await tx.select({ slug: games.slug }).from(games)
      .where(and(eq(games.genre, "Other"), eq(games.coverGradient, "green")));
    for (const game of suspicious) {
      console.warn(`  note: game "${game.slug}" looks auto-created; review it in the admin portal`);
    }
  });

  if (!apply) console.log("\nDry run. Re-run with `-- --apply` to delete.");
}

cleanup()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => sqlClient.end());
