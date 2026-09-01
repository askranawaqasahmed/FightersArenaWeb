import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import {
  divisions,
  gamerProfiles,
  games,
  registrations,
  stageParticipants,
  stages,
  tournaments,
  users,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import {
  registerParticipantTx,
  reviewRegistrationTx,
  setTournamentRegistrationStateTx,
  startDivisionTx,
  withdrawRegistrationTx,
} from "@/lib/tournament-lifecycle";

const rollback = new Error("ROLLBACK_VALIDATION_DATA");

describe("mobile registration flow against PostgreSQL", () => {
  it("runs draft → publish → open → self-register → approve → close → start, with withdraw and reject paths", async () => {
    try {
      await db.transaction(async (tx) => {
        const suffix = crypto.randomUUID().slice(0, 8);
        const [game] = await tx.insert(games).values({
          slug: `mobile-flow-${suffix}`,
          name: `Mobile Flow ${suffix}`,
          genre: "Fighting",
          teamSize: 1,
          coverGradient: "linear-gradient(#111,#222)",
        }).returning();
        const [event] = await tx.insert(tournaments).values({
          slug: `mobile-flow-event-${suffix}`,
          name: "Mobile flow validation event",
          status: "draft",
        }).returning();
        const [division] = await tx.insert(divisions).values({
          tournamentId: event.id,
          gameId: game.id,
          name: "Mobile Open",
          competitionType: "tournament",
          participantType: "gamer",
          maxParticipants: 16,
        }).returning();
        await tx.insert(stages).values({ divisionId: division.id, name: "Playoffs", sequence: 1, format: "single_elimination", configuration: { bestOf: 3 } });

        const players = [] as Array<{ profileId: string; name: string }>;
        for (let index = 0; index < 3; index += 1) {
          const [user] = await tx.insert(users).values({ status: "active" }).returning();
          const [profile] = await tx.insert(gamerProfiles).values({
            userId: user.id,
            slug: `mobile-player-${index}-${suffix}`,
            displayName: `Mobile Player ${index + 1}`,
            handle: `MP${index + 1}`,
          }).returning();
          players.push({ profileId: profile.id, name: `Mobile Player ${index + 1}` });
        }

        // Registration is impossible while the event is a draft or merely published.
        await expect(registerParticipantTx(tx, { divisionId: division.id, participantId: players[0].profileId, participantType: "gamer", displayName: players[0].name }))
          .rejects.toMatchObject({ code: "REGISTRATION_CLOSED" } satisfies Partial<LifecycleError>);
        await expect(setTournamentRegistrationStateTx(tx, event.id, "close_registration"))
          .rejects.toMatchObject({ code: "INVALID_TOURNAMENT_TRANSITION" } satisfies Partial<LifecycleError>);
        await expect(setTournamentRegistrationStateTx(tx, event.id, "publish"))
          .resolves.toMatchObject({ status: "published", syncedDivisions: 1 });
        await expect(registerParticipantTx(tx, { divisionId: division.id, participantId: players[0].profileId, participantType: "gamer", displayName: players[0].name }))
          .rejects.toMatchObject({ code: "REGISTRATION_CLOSED" } satisfies Partial<LifecycleError>);

        // Open registration and let three players self-register.
        await expect(setTournamentRegistrationStateTx(tx, event.id, "open_registration"))
          .resolves.toMatchObject({ status: "registration_open" });
        const created = [] as Array<{ id: string; profileId: string }>;
        for (const player of players) {
          const registration = await registerParticipantTx(tx, {
            divisionId: division.id,
            participantId: player.profileId,
            participantType: "gamer",
            displayName: player.name,
          });
          expect(registration).toMatchObject({ status: "registered", eligible: false, checkedInAt: null });
          created.push({ id: registration.id, profileId: player.profileId });
        }

        // Public entrants view: registered + confirmed only.
        const entrants = await tx.select().from(registrations).where(and(
          eq(registrations.divisionId, division.id),
          inArray(registrations.status, ["registered", "confirmed"]),
        ));
        expect(entrants).toHaveLength(3);

        // Approve two, reject one; the rejected player disappears from the entrant pool.
        await expect(reviewRegistrationTx(tx, { divisionId: division.id, registrationId: created[0].id, action: "approve" }))
          .resolves.toMatchObject({ status: "confirmed", eligible: true });
        await expect(reviewRegistrationTx(tx, { divisionId: division.id, registrationId: created[1].id, action: "approve" }))
          .resolves.toMatchObject({ status: "confirmed", eligible: true });
        await expect(reviewRegistrationTx(tx, { divisionId: division.id, registrationId: created[2].id, action: "reject" }))
          .resolves.toMatchObject({ status: "rejected", eligible: false });
        const activeAfterReview = await tx.select().from(registrations).where(and(
          eq(registrations.divisionId, division.id),
          inArray(registrations.status, ["registered", "confirmed"]),
        ));
        expect(activeAfterReview).toHaveLength(2);

        // A withdrawn registration can re-register while registration is open.
        const withdrawn = await withdrawRegistrationTx(tx, { registrationId: created[1].id, gamerProfileId: created[1].profileId });
        expect(withdrawn.status).toBe("withdrawn");
        const reRegistered = await registerParticipantTx(tx, {
          divisionId: division.id,
          participantId: created[1].profileId,
          participantType: "gamer",
          displayName: players[1].name,
        });
        expect(reRegistered).toMatchObject({ id: created[1].id, status: "registered", eligible: false });
        await expect(reviewRegistrationTx(tx, { divisionId: division.id, registrationId: created[1].id, action: "approve" }))
          .resolves.toMatchObject({ status: "confirmed", eligible: true });

        // Close registration, then start: both approved players are seeded.
        await expect(setTournamentRegistrationStateTx(tx, event.id, "close_registration"))
          .resolves.toMatchObject({ status: "registration_closed" });
        const started = await startDivisionTx(tx, division.id);
        expect(started.actualParticipants).toBe(2);
        const [stage] = await tx.select({ id: stages.id }).from(stages).where(eq(stages.divisionId, division.id));
        const seeded = await tx.select().from(stageParticipants).where(eq(stageParticipants.stageId, stage.id));
        expect(seeded.map((row) => row.participantId).sort()).toEqual([created[0].profileId, created[1].profileId].sort());

        // Nothing can be withdrawn or reviewed once the competition is live.
        await expect(withdrawRegistrationTx(tx, { registrationId: created[0].id, gamerProfileId: created[0].profileId }))
          .rejects.toMatchObject({ code: "DIVISION_STARTED" } satisfies Partial<LifecycleError>);
        await expect(reviewRegistrationTx(tx, { divisionId: division.id, registrationId: created[0].id, action: "reject" }))
          .rejects.toMatchObject({ code: "DIVISION_STARTED" } satisfies Partial<LifecycleError>);

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
