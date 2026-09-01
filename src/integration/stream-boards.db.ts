import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  auditEvents,
  countries,
  divisions,
  gamerProfiles,
  games,
  matchSides,
  matches,
  registrations,
  stages,
  streamBoards,
  tournaments,
  users,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import { boardVersion, getBoardState, toSimpleBoard } from "@/lib/stream-board-data";
import {
  adjustMatchScoreTx,
  finishMatchTx,
  getDivisionPreviewTx,
  startDivisionTx,
  startMatchTx,
  stopMatchTx,
} from "@/lib/tournament-lifecycle";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("stream boards against PostgreSQL", () => {
  it("adjusts live scores, assigns boards, and serves overlay state", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const boardNumber = 100_000 + Math.floor(Math.random() * 100_000);
        const [game] = await tx.insert(games).values({
          slug: `boards-${suffix}`,
          name: `Boards Validation ${suffix}`,
          genre: "Fighting",
          teamSize: 1,
          coverGradient: "linear-gradient(#111,#222)",
        }).returning();
        const [event] = await tx.insert(tournaments).values({
          slug: `boards-event-${suffix}`,
          name: "Boards validation event",
          status: "registration_open",
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 86_400_000),
        }).returning();
        const [division] = await tx.insert(divisions).values({
          tournamentId: event.id,
          gameId: game.id,
          name: "Boards Singles",
          competitionType: "tournament",
          participantType: "gamer",
          maxParticipants: 8,
        }).returning();
        await tx.insert(stages).values({
          divisionId: division.id,
          name: "Single elimination",
          sequence: 1,
          format: "single_elimination",
          configuration: { bestOf: 3 },
        });

        const [country] = await tx.insert(countries).values({
          iso2: "ZZ",
          name: "Boardland",
          phoneCode: "+999",
        }).onConflictDoNothing({ target: countries.iso2 }).returning();
        const [profileUser] = await tx.insert(users).values({ status: "active" }).returning();
        const [gamer] = await tx.insert(gamerProfiles).values({
          userId: profileUser.id,
          slug: `board-gamer-${suffix}`,
          displayName: `Board Gamer ${suffix}`,
          handle: `BOARD${suffix}`,
          bio: "Public overlay bio",
          countryId: country?.id,
          rankingPoints: 1500,
        }).returning();

        const participantIds = [gamer.id, crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
        await tx.insert(registrations).values(participantIds.map((participantId, index) => ({
          divisionId: division.id,
          participantId,
          participantType: "gamer" as const,
          displayNameSnapshot: participantId === gamer.id ? gamer.displayName : `Boards Player ${index + 1}`,
          status: "confirmed" as const,
          seed: index + 1,
          eligible: true,
          checkedInAt: new Date(),
        })));

        await startDivisionTx(tx, division.id);
        const preview = await getDivisionPreviewTx(tx, division.id);
        const targetMatch = preview.matches.find((match) =>
          match.sides.some((side) => side.participantId === gamer.id)
          && match.sides.filter((side) => side.participantId).length === 2);
        expect(targetMatch).toBeTruthy();
        const matchId = targetMatch!.id;

        // Scores cannot be adjusted before the match is live.
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 1, delta: 1 }))
          .rejects.toMatchObject({ code: "MATCH_NOT_LIVE", status: 409 } satisfies Partial<LifecycleError>);

        await startMatchTx(tx, matchId);
        const [beforeAdjust] = await tx.select({ updatedAt: matches.updatedAt }).from(matches).where(eq(matches.id, matchId));
        await new Promise((resolve) => setTimeout(resolve, 5));

        await expect(adjustMatchScoreTx(tx, { matchId, slot: 1, delta: 1 })).resolves.toMatchObject({ scores: [1, 0] });
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 2, delta: 1 })).resolves.toMatchObject({ scores: [1, 1] });
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 2, delta: -1 })).resolves.toMatchObject({ scores: [1, 0] });
        // Clamped at zero: a further decrement is an idempotent no-op.
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 2, delta: -1 })).resolves.toMatchObject({ scores: [1, 0] });

        const [afterAdjust] = await tx.select({ updatedAt: matches.updatedAt }).from(matches).where(eq(matches.id, matchId));
        expect(afterAdjust.updatedAt.getTime()).toBeGreaterThan(beforeAdjust.updatedAt.getTime());
        const auditRows = await tx.select().from(auditEvents).where(and(
          eq(auditEvents.action, "match.score_adjusted"),
          eq(auditEvents.entityId, matchId),
        ));
        expect(auditRows).toHaveLength(3);

        // Adjustment also works while paused.
        await stopMatchTx(tx, matchId);
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 1, delta: 1 })).resolves.toMatchObject({ scores: [2, 0] });
        await startMatchTx(tx, matchId);

        // Board assignment upsert: assign, reassign featured slot, then read overlay state.
        await tx.insert(streamBoards).values({ number: boardNumber, matchId, featuredSlot: 1 })
          .onConflictDoUpdate({ target: streamBoards.number, set: { matchId, featuredSlot: 1, updatedAt: new Date() } });

        const barState = await getBoardState(boardNumber, {}, tx);
        expect(barState.board).toMatchObject({ number: boardNumber, assigned: true, featuredSlot: 1 });
        expect(barState.match).toMatchObject({ id: matchId, status: "live", code: targetMatch!.code });
        expect(barState.tournament?.name).toBe("Boards validation event");
        expect(barState.game?.name).toBe(`Boards Validation ${suffix}`);
        const gamerSide = barState.sides.find((side) => side.participantId === gamer.id);
        expect(gamerSide).toMatchObject({ participantType: "gamer", score: 2 });
        expect(gamerSide?.gamer).toMatchObject({ slug: gamer.slug, handle: gamer.handle });

        const profileState = await getBoardState(boardNumber, { includeProfile: true, slotOverride: gamerSide!.slot as 1 | 2 }, tx);
        expect(profileState.featured).toMatchObject({
          participantType: "gamer",
          handle: gamer.handle,
          bio: "Public overlay bio",
          rankingPoints: 1500,
        });

        // Simple external format: profiles attached to every side, flat player objects.
        const simple = toSimpleBoard(await getBoardState(boardNumber, { allProfiles: true }, tx));
        expect(simple).toMatchObject({ board: boardNumber, assigned: true, status: "live", game: `Boards Validation ${suffix}` });
        const simpleGamer = simple.players.find((player) => player.slot === gamerSide!.slot);
        expect(simpleGamer).toMatchObject({ name: gamer.displayName, score: 2, handle: gamer.handle, bio: "Public overlay bio", rankingPoints: 1500 });
        const simpleDummy = simple.players.find((player) => player.slot !== gamerSide!.slot);
        expect(simpleDummy?.name).toBeTruthy();
        expect(simpleDummy?.record).toBeTruthy();

        // The version changes when a score changes.
        const versionBefore = boardVersion(barState);
        await adjustMatchScoreTx(tx, { matchId, slot: 2, delta: 1 });
        const versionAfter = boardVersion(await getBoardState(boardNumber, {}, tx));
        expect(versionAfter).not.toBe(versionBefore);

        // Finishing overwrites live-adjusted scores with the submitted tuple.
        await finishMatchTx(tx, { matchId, winnerParticipantId: gamer.id, scores: [3, 1], startNext: false });
        const finalState = await getBoardState(boardNumber, {}, tx);
        expect(finalState.match).toMatchObject({ status: "final", winnerParticipantId: gamer.id });
        expect(finalState.sides.find((side) => side.participantId === gamer.id)?.score).toBe(3);
        const finalScores = await tx.select({ score: matchSides.score }).from(matchSides)
          .where(eq(matchSides.matchId, matchId)).orderBy(asc(matchSides.slot));
        expect(finalScores.map((row) => row.score).sort((a, b) => b - a)).toEqual([3, 1]);

        // Scores are locked again after the match is final.
        await expect(adjustMatchScoreTx(tx, { matchId, slot: 1, delta: 1 }))
          .rejects.toMatchObject({ code: "MATCH_NOT_LIVE" } satisfies Partial<LifecycleError>);

        // Unassigning leaves an unassigned payload rather than an error.
        await tx.update(streamBoards).set({ matchId: null, updatedAt: new Date() }).where(eq(streamBoards.number, boardNumber));
        const unassigned = await getBoardState(boardNumber, {}, tx);
        expect(unassigned.board.assigned).toBe(false);
        expect(unassigned.match).toBeNull();

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
