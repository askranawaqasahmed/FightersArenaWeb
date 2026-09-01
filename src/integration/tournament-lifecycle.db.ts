import { and, asc, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  divisions,
  gamerProfiles,
  games,
  matchSides,
  matches,
  registrations,
  sponsors,
  sponsorships,
  stages,
  tournamentParticipantSnapshots,
  tournaments,
  users,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import {
  changeParticipantSponsorTx,
  completeDivisionTx,
  editMatchResultTx,
  finishMatchTx,
  getDivisionPreviewTx,
  registerParticipantTx,
  setRegistrationPolicyTx,
  startMatchTx,
  startDivisionTx,
  stopMatchTx,
} from "@/lib/tournament-lifecycle";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("tournament lifecycle against PostgreSQL", () => {
  it("validates unrestricted 48-player start, restricted slots, every format, controls, snapshots, and sponsor history", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const [game] = await tx.insert(games).values({
          slug: `lifecycle-${suffix}`,
          name: `Lifecycle Validation ${suffix}`,
          genre: "Fighting",
          teamSize: 1,
          coverGradient: "linear-gradient(#111,#222)",
        }).returning();
        const [event] = await tx.insert(tournaments).values({
          slug: `lifecycle-event-${suffix}`,
          name: "Lifecycle validation event",
          status: "registration_open",
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 86_400_000),
        }).returning();
        const createdDivisions = await tx.insert(divisions).values([
          { tournamentId: event.id, gameId: game.id, name: "Single 48", competitionType: "tournament", participantType: "gamer", maxParticipants: 64 },
          { tournamentId: event.id, gameId: game.id, name: "Double 6 capped", competitionType: "tournament", participantType: "gamer", maxParticipants: 64, registrationRestricted: true, registrationLimit: 6 },
          { tournamentId: event.id, gameId: game.id, name: "Round robin 5", competitionType: "tournament", participantType: "gamer", maxParticipants: 16 },
          { tournamentId: event.id, gameId: game.id, name: "League 4", competitionType: "league", participantType: "team", maxParticipants: 12 },
        ]).returning();
        const [singleDivision, doubleDivision, roundRobinDivision, leagueDivision] = createdDivisions;

        const [profileUser] = await tx.insert(users).values({ status: "active" }).returning();
        const originalDisplayName = `Historic Player ${suffix}`;
        const [historicGamer] = await tx.insert(gamerProfiles).values({
          userId: profileUser.id,
          slug: `historic-${suffix}`,
          displayName: originalDisplayName,
          handle: `HIST${suffix}`,
          bio: "Profile at tournament completion",
          rankingPoints: 2100,
        }).returning();

        const participantSets = {
          single: [historicGamer.id, ...Array.from({ length: 47 }, () => crypto.randomUUID())],
          double: Array.from({ length: 6 }, () => crypto.randomUUID()),
          roundRobin: Array.from({ length: 5 }, () => crypto.randomUUID()),
          league: Array.from({ length: 4 }, () => crypto.randomUUID()),
        };
        for (const [division, participantIds] of [
          [singleDivision, participantSets.single],
          [doubleDivision, participantSets.double],
          [roundRobinDivision, participantSets.roundRobin],
          [leagueDivision, participantSets.league],
        ] as const) {
          await tx.insert(registrations).values(participantIds.map((participantId, index) => ({
            divisionId: division.id,
            participantId,
            participantType: division.participantType,
            displayNameSnapshot: participantId === historicGamer.id ? originalDisplayName : `${division.name} Participant ${index + 1}`,
            status: "confirmed" as const,
            seed: index + 1,
            eligible: true,
            checkedInAt: new Date(),
            rosterSnapshot: division.participantType === "team" ? [{ role: "captain", name: `Captain ${index + 1}` }] : [],
          })));
        }

        await expect(registerParticipantTx(tx, {
          divisionId: doubleDivision.id,
          participantId: crypto.randomUUID(),
          participantType: "gamer",
          displayName: "Blocked player",
        })).rejects.toMatchObject({ code: "SLOTS_FULL" } satisfies Partial<LifecycleError>);
        await expect(setRegistrationPolicyTx(tx, doubleDivision.id, true, 5))
          .rejects.toMatchObject({ code: "LIMIT_BELOW_REGISTRATIONS" } satisfies Partial<LifecycleError>);
        await expect(registerParticipantTx(tx, {
          divisionId: singleDivision.id,
          participantId: crypto.randomUUID(),
          participantType: "gamer",
          displayName: "Unrestricted player",
        })).resolves.toMatchObject({ divisionId: singleDivision.id });
        await tx.delete(registrations).where(and(
          eq(registrations.divisionId, singleDivision.id),
          eq(registrations.displayNameSnapshot, "Unrestricted player"),
        ));

        const createdStages = await tx.insert(stages).values([
          { divisionId: singleDivision.id, name: "Single elimination", sequence: 1, format: "single_elimination", configuration: { bestOf: 3 } },
          { divisionId: doubleDivision.id, name: "Double elimination", sequence: 1, format: "double_elimination", configuration: { bestOf: 3, grandFinalReset: false } },
          { divisionId: roundRobinDivision.id, name: "Round robin", sequence: 1, format: "round_robin", configuration: { bestOf: 3, legs: 1 } },
          { divisionId: leagueDivision.id, name: "League fixtures", sequence: 1, format: "round_robin", configuration: { bestOf: 1, legs: 2 } },
        ]).returning();

        const [sponsorA, sponsorB] = await tx.insert(sponsors).values([
          { slug: `sponsor-a-${suffix}`, name: "Historic Sponsor A", verificationStatus: "verified" },
          { slug: `sponsor-b-${suffix}`, name: "Historic Sponsor B", verificationStatus: "verified" },
        ]).returning();
        await changeParticipantSponsorTx(tx, {
          subjectType: "gamer",
          subjectId: historicGamer.id,
          sponsorId: sponsorA.id,
          startsAt: new Date(Date.now() - 86_400_000),
        });

        const startedSingle = await startDivisionTx(tx, singleDivision.id);
        expect(startedSingle).toMatchObject({ divisionId: singleDivision.id, actualParticipants: 48, generatedSize: 64 });
        const [untouchedDouble] = await tx.select({ status: divisions.status }).from(divisions).where(eq(divisions.id, doubleDivision.id));
        expect(untouchedDouble.status).toBe("draft");
        expect(await tx.select().from(matches).innerJoin(stages, eq(stages.id, matches.stageId)).where(eq(stages.divisionId, doubleDivision.id))).toHaveLength(0);
        await startDivisionTx(tx, doubleDivision.id);
        const doublePreview = await getDivisionPreviewTx(tx, doubleDivision.id);
        const upperRoundOne = doublePreview.matches.filter((match) => match.code.startsWith("U1-"));
        const lowerRoundOne = doublePreview.matches.filter((match) => match.code.startsWith("L1-"));
        expect(new Set(doublePreview.matches.map((match) => match.matchNumber)).size).toBe(doublePreview.matches.length);
        expect(upperRoundOne.map((match) => match.code)).toEqual(expect.arrayContaining(["U1-M3", "U1-M4"]));
        expect(Math.max(...upperRoundOne.map((match) => match.matchNumber)))
          .toBeLessThan(Math.min(...lowerRoundOne.map((match) => match.matchNumber)));
        const finalMatches = doublePreview.matches.filter((match) => match.lane === "final");
        const nonFinalMatches = doublePreview.matches.filter((match) => match.lane !== "final");
        expect(Math.min(...finalMatches.map((match) => match.matchNumber)))
          .toBeGreaterThan(Math.max(...nonFinalMatches.map((match) => match.matchNumber)));
        await startDivisionTx(tx, roundRobinDivision.id);
        await startDivisionTx(tx, leagueDivision.id);
        const [singleStage] = await tx.select().from(stages).where(eq(stages.divisionId, singleDivision.id));
        expect(singleStage.configuration).toMatchObject({ actualParticipantCount: 48, generatedBracketSize: 64 });

        await expect(completeDivisionTx(tx, singleDivision.id))
          .rejects.toMatchObject({ code: "STAGES_INCOMPLETE" } satisfies Partial<LifecycleError>);

        await changeParticipantSponsorTx(tx, {
          subjectType: "gamer",
          subjectId: historicGamer.id,
          sponsorId: sponsorB.id,
          startsAt: new Date(),
        });
        const sponsorHistory = await tx.select().from(sponsorships)
          .where(eq(sponsorships.subjectId, historicGamer.id)).orderBy(asc(sponsorships.startsAt));
        expect(sponsorHistory).toHaveLength(2);
        expect(sponsorHistory[0]).toMatchObject({ status: "ended" });
        expect(sponsorHistory[0].endsAt).not.toBeNull();
        expect(sponsorHistory[1]).toMatchObject({ status: "active" });

        let controlsValidated = false;
        let resultEditValidated = false;
        let capturedParticipants = 0;
        for (const [stageIndex, stage] of createdStages.entries()) {
          while (true) {
            const [next] = await tx.select({ id: matches.id, status: matches.status }).from(matches)
              .where(and(eq(matches.stageId, stage.id), inArray(matches.status, ["live", "ready"]))).limit(1);
            if (!next) break;
            if (next.status === "ready") await startMatchTx(tx, next.id);
            const [liveTiming] = await tx.select({ startedAt: matches.startedAt, endedAt: matches.endedAt }).from(matches).where(eq(matches.id, next.id));
            expect(liveTiming.startedAt).toBeInstanceOf(Date);
            expect(liveTiming.endedAt).toBeNull();
            if (!controlsValidated) {
              await stopMatchTx(tx, next.id);
              await startMatchTx(tx, next.id);
              controlsValidated = true;
            }
            const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, next.id)).orderBy(asc(matchSides.slot));
            const winnerId = sides[0].participantId;
            expect(winnerId).toBeTruthy();
            await finishMatchTx(tx, {
              matchId: next.id,
              winnerParticipantId: winnerId,
              scores: [1, 0],
              startNext: controlsValidated && stage.id === createdStages[0].id,
            });
            const [finishedTiming] = await tx.select({ endedAt: matches.endedAt }).from(matches).where(eq(matches.id, next.id));
            expect(finishedTiming.endedAt).toBeInstanceOf(Date);
            if (!resultEditValidated) {
              await editMatchResultTx(tx, {
                matchId: next.id,
                winnerParticipantId: winnerId,
                scores: [2, 0],
                reason: "Integration correction validation",
              });
              const [editedMatch] = await tx.select({ resultVersion: matches.resultVersion }).from(matches).where(eq(matches.id, next.id));
              const editedSides = await tx.select({ score: matchSides.score }).from(matchSides)
                .where(eq(matchSides.matchId, next.id)).orderBy(asc(matchSides.slot));
              expect(editedMatch.resultVersion).toBe(2);
              expect(editedSides.map((side) => side.score)).toEqual([2, 0]);
              resultEditValidated = true;
            }
          }
          const [completedStage] = await tx.select({ status: stages.status }).from(stages).where(eq(stages.id, stage.id));
          expect(completedStage.status).toBe("completed");
          const completedDivision = await completeDivisionTx(tx, stage.divisionId);
          capturedParticipants += completedDivision.capturedParticipants;
          if (stageIndex < createdStages.length - 1) expect(completedDivision.eventCompleted).toBe(false);
        }

        expect(capturedParticipants).toBe(63);
        const [completedEvent] = await tx.select({ status: tournaments.status }).from(tournaments).where(eq(tournaments.id, event.id));
        expect(completedEvent.status).toBe("completed");
        const snapshots = await tx.select().from(tournamentParticipantSnapshots)
          .where(eq(tournamentParticipantSnapshots.tournamentId, event.id));
        expect(snapshots).toHaveLength(63);
        expect(snapshots.every((snapshot) => snapshot.finalRank && snapshot.finalRank > 0)).toBe(true);
        const historicSnapshot = snapshots.find((snapshot) => snapshot.participantId === historicGamer.id);
        expect(historicSnapshot?.displayName).toBe(originalDisplayName);
        expect(historicSnapshot?.sponsorSnapshot).toHaveLength(2);

        await tx.update(gamerProfiles).set({ displayName: "Changed after event", rankingPoints: 9999 })
          .where(eq(gamerProfiles.id, historicGamer.id));
        await tx.update(sponsors).set({ name: "Renamed after event" }).where(eq(sponsors.id, sponsorB.id));
        const [unchangedSnapshot] = await tx.select().from(tournamentParticipantSnapshots)
          .where(eq(tournamentParticipantSnapshots.participantId, historicGamer.id));
        expect(unchangedSnapshot.displayName).toBe(originalDisplayName);
        expect(unchangedSnapshot.profileSnapshot).toMatchObject({ displayName: originalDisplayName, rankingPoints: 2100 });
        expect(unchangedSnapshot.sponsorSnapshot).toEqual(expect.arrayContaining([
          expect.objectContaining({ sponsorName: "Historic Sponsor B" }),
        ]));

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
