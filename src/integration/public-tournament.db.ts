import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  divisions,
  gamerProfiles,
  games,
  matchSides,
  registrations,
  stages,
  tournaments,
  users,
} from "@/db/schema";
import {
  getPublicBracket,
  getPublicTournament,
  getPublicTournaments,
} from "@/lib/public-tournament-data";
import { adjustMatchScoreTx, finishMatchTx, startDivisionTx, startMatchTx } from "@/lib/tournament-lifecycle";

const rollback = new Error("ROLLBACK_PUBLIC_TOURNAMENT");

describe("public tournament read model against PostgreSQL", () => {
  it("hides drafts, exposes started events, and serves a live bracket", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const [game] = await tx.insert(games).values({
          slug: `public-${suffix}`, name: `Public Validation ${suffix}`, genre: "Fighting",
          teamSize: 1, coverGradient: "linear-gradient(#111,#222)",
        }).returning();

        // A draft event must never surface publicly.
        const [draft] = await tx.insert(tournaments).values({
          slug: `public-draft-${suffix}`, name: "Draft event", status: "draft",
          startsAt: new Date(), endsAt: new Date(),
        }).returning();

        const [event] = await tx.insert(tournaments).values({
          slug: `public-live-${suffix}`, name: "Public live event", status: "live",
          description: "Visible to spectators", startsAt: new Date(), endsAt: new Date(),
        }).returning();
        const [division] = await tx.insert(divisions).values({
          tournamentId: event.id, gameId: game.id, name: "Open Division",
          competitionType: "tournament", participantType: "gamer", maxParticipants: 8,
        }).returning();
        await tx.insert(stages).values({
          divisionId: division.id, name: "Main bracket", sequence: 1,
          format: "single_elimination", configuration: { bestOf: 3 },
        });

        const participantIds: string[] = [];
        for (let index = 0; index < 4; index += 1) {
          const [u] = await tx.insert(users).values({ status: "active" }).returning();
          const [gp] = await tx.insert(gamerProfiles).values({
            userId: u.id, slug: `public-gamer-${index}-${suffix}`,
            displayName: `Public Player ${index + 1}`, handle: `PUB${index}${suffix}`,
            rankingPoints: 1000 + index,
          }).returning();
          participantIds.push(gp.id);
        }
        await tx.insert(registrations).values(participantIds.map((id, index) => ({
          divisionId: division.id, participantId: id, participantType: "gamer" as const,
          displayNameSnapshot: `Public Player ${index + 1}`, status: "confirmed" as const,
          seed: index + 1, eligible: true, checkedInAt: new Date(),
        })));

        // Before start: listed, but no bracket is available.
        const beforeStart = await getPublicTournament(event.slug, tx);
        expect(beforeStart).not.toBeNull();
        expect(beforeStart!.divisionList[0]).toMatchObject({ bracketAvailable: false, totalMatches: 0 });

        const draftView = await getPublicTournament(draft.slug, tx);
        expect(draftView).toBeNull();

        const listed = await getPublicTournaments(tx);
        expect(listed.some((row) => row.slug === event.slug)).toBe(true);
        expect(listed.some((row) => row.slug === draft.slug)).toBe(false);

        // After start: bracket, matches and standings become public.
        await startDivisionTx(tx, division.id);
        const started = await getPublicTournament(event.slug, tx);
        expect(started!.divisionList[0]).toMatchObject({ bracketAvailable: true, participants: 4 });
        expect(started!.teams).toBe(4);

        const view = await getPublicBracket(event.slug, division.id, tx);
        expect(view).not.toBeNull();
        expect(view!.bracket?.format).toBe("single_elimination");
        expect(view!.matches.length).toBeGreaterThan(0);
        expect(view!.standings.length).toBe(4);
        // Seeds are exposed so the public bracket can label entrants.
        const seeded = view!.matches.flatMap((match) => match.sides).filter((side) => side.seed);
        expect(seeded.length).toBeGreaterThan(0);

        // A live score change must move the version so pollers refresh.
        // Pick a round-one match: later rounds have unresolved sides and cannot start.
        const startableCode = view!.matches
          .filter((match) => match.sides.filter((side) => side.participantId).length === 2)
          .sort((left, right) => left.matchNumber - right.matchNumber)[0];
        expect(startableCode).toBeTruthy();
        const firstMatch = { id: startableCode.id };
        await startMatchTx(tx, firstMatch.id);
        const liveBefore = await getPublicBracket(event.slug, division.id, tx);
        await adjustMatchScoreTx(tx, { matchId: firstMatch.id, slot: 1, delta: 1 });
        const liveAfter = await getPublicBracket(event.slug, division.id, tx);
        expect(liveAfter!.version).not.toBe(liveBefore!.version);
        expect(liveAfter!.division.liveMatches).toBe(1);

        // Finishing the match records the winner publicly.
        const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, firstMatch.id)).orderBy(asc(matchSides.slot));
        await finishMatchTx(tx, { matchId: firstMatch.id, winnerParticipantId: sides[0].participantId, scores: [2, 0], startNext: false });
        const finished = await getPublicBracket(event.slug, division.id, tx);
        const finishedMatch = finished!.matches.find((match) => match.id === firstMatch.id);
        expect(finishedMatch).toMatchObject({ status: "final", winnerParticipantId: sides[0].participantId });
        expect(finishedMatch!.sides.map((side) => side.score)).toEqual([2, 0]);

        // An unknown division falls back to null rather than leaking another event.
        expect(await getPublicBracket(event.slug, crypto.randomUUID(), tx)).toBeNull();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
