import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  cities,
  countries,
  divisions,
  gamerProfiles,
  games,
  registrations,
  stages,
  tournaments,
  users,
} from "@/db/schema";
import { getPublicGamer, getPublicGamers, resolveParticipantLinks } from "@/lib/public-gamer-data";
import { getPublicBracket } from "@/lib/public-tournament-data";
import { startDivisionTx } from "@/lib/tournament-lifecycle";

const rollback = new Error("ROLLBACK_PUBLIC_GAMER");

describe("public gamer read model against PostgreSQL", () => {
  it("exposes public profiles, hides private ones, and links bracket participants", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const [country] = await tx.insert(countries).values({ iso2: "PK", name: "Pakistan", phoneCode: "+92" })
          .onConflictDoUpdate({ target: countries.iso2, set: { name: "Pakistan" } }).returning();
        const [city] = await tx.insert(cities).values({
          countryId: country.id, name: `Testville-${suffix}`, timeZone: "Asia/Karachi",
        }).returning();
        const [game] = await tx.insert(games).values({
          slug: `gamer-pub-${suffix}`, name: `Gamer Public ${suffix}`, genre: "Fighting",
          teamSize: 1, coverGradient: "linear-gradient(#111,#222)",
        }).returning();

        const makeGamer = async (name: string, handle: string, points: number, visibility: "public" | "private") => {
          const [u] = await tx.insert(users).values({ status: "active" }).returning();
          const [gp] = await tx.insert(gamerProfiles).values({
            userId: u.id, slug: `${handle.toLowerCase()}-${suffix}`, displayName: name, handle,
            bio: `${name} biography`, countryId: country.id, cityId: city.id,
            avatarUrl: `/api/v1/media/avatars/${handle.toLowerCase()}.png`,
            profileVisibility: visibility, verificationStatus: "verified", rankingPoints: points,
          }).returning();
          return gp;
        };

        const top = await makeGamer("Top Player", `TOP${suffix}`, 5000, "public");
        const second = await makeGamer("Second Player", `SEC${suffix}`, 4000, "public");
        const hidden = await makeGamer("Hidden Player", `HID${suffix}`, 9999, "private");

        // Directory: public only, ranked by points.
        const listed = await getPublicGamers(tx);
        const listedSlugs = listed.map((row) => row.slug);
        expect(listedSlugs).toContain(top.slug);
        expect(listedSlugs).toContain(second.slug);
        expect(listedSlugs).not.toContain(hidden.slug);
        const topIndex = listedSlugs.indexOf(top.slug);
        const secondIndex = listedSlugs.indexOf(second.slug);
        expect(topIndex).toBeLessThan(secondIndex);

        // A private profile is not reachable by direct slug either.
        expect(await getPublicGamer(hidden.slug, tx)).toBeNull();

        const profile = await getPublicGamer(top.slug, tx);
        expect(profile).not.toBeNull();
        expect(profile!).toMatchObject({
          handle: `TOP${suffix}`,
          name: "Top Player",
          initials: "TP",
          bio: "Top Player biography",
          country: "Pakistan",
          verified: true,
          points: 5000,
        });
        expect(profile!.city).toBe(`Testville-${suffix}`);
        // Games are derived from play, so a player who has not competed has none.
        expect(profile!.games).toEqual([]);
        // No events entered yet.
        expect(profile!.events).toEqual([]);
        expect(profile!.totals).toMatchObject({ events: 0, played: 0, wins: 0, titles: 0 });

        // Enter both public players into a started competition.
        const [event] = await tx.insert(tournaments).values({
          slug: `gamer-event-${suffix}`, name: "Gamer public event", status: "live",
          startsAt: new Date(), endsAt: new Date(),
        }).returning();
        const [division] = await tx.insert(divisions).values({
          tournamentId: event.id, gameId: game.id, name: "Open Division",
          competitionType: "tournament", participantType: "gamer", maxParticipants: 4,
        }).returning();
        await tx.insert(stages).values({
          divisionId: division.id, name: "Main bracket", sequence: 1,
          format: "single_elimination", configuration: { bestOf: 3 },
        });
        await tx.insert(registrations).values([top, second].map((gamer, index) => ({
          divisionId: division.id, participantId: gamer.id, participantType: "gamer" as const,
          displayNameSnapshot: gamer.handle, status: "confirmed" as const,
          seed: index + 1, eligible: true, checkedInAt: new Date(),
        })));
        await startDivisionTx(tx, division.id);

        // The profile now lists the event it was entered into.
        const withEvent = await getPublicGamer(top.slug, tx);
        expect(withEvent!.games).toEqual([{ game: game.name, inGameName: `TOP${suffix}`, primaryRole: null, platform: null, verified: true }]);
        expect(withEvent!.events).toHaveLength(1);
        expect(withEvent!.events[0]).toMatchObject({
          tournamentSlug: event.slug,
          tournamentName: "Gamer public event",
          divisionName: "Open Division",
          status: "live",
        });
        expect(withEvent!.totals.events).toBe(1);

        // Bracket sides carry the profile slug so public pages can link to the player.
        const view = await getPublicBracket(event.slug, division.id, tx);
        const linkedSide = view!.matches
          .flatMap((match) => match.sides)
          .find((side) => side.participantId === top.id);
        expect(linkedSide).toMatchObject({ participantType: "gamer", profileSlug: top.slug });
        const linkedStanding = view!.standings.find((row) => row.profileSlug === top.slug);
        expect(linkedStanding).toMatchObject({ participantType: "gamer" });

        // A private participant is never given a public link.
        const links = await resolveParticipantLinks([
          { id: top.id, type: "gamer" },
          { id: hidden.id, type: "gamer" },
        ], tx);
        expect(links.get(top.id)).toMatchObject({ kind: "gamer", slug: top.slug });
        expect(links.get(hidden.id)).toBeUndefined();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
