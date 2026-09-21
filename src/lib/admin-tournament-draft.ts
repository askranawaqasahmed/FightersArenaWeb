import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { auditEvents, divisions, games, registrations, stages, tournaments } from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";
import type { AdminLifecycleCompetition } from "@/lib/admin-events";
import type { StageFormat, TournamentDraft } from "@/lib/tournament-draft";

function databaseStageFormat(format: StageFormat) {
  if (format === "groups") return "round_robin" as const;
  return format === "single-elimination" ? "single_elimination" as const : "double_elimination" as const;
}

function eventDate(value: string) {
  return new Date(`${value}T00:00:00+05:00`);
}

export async function saveTournamentDraftToDatabase(
  draft: TournamentDraft & { slug: string },
  context: { actorUserId: string; requestId?: string },
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(tournaments).where(eq(tournaments.slug, draft.slug)).limit(1);
    if (existing && !["draft", "published"].includes(existing.status)) {
      throw new LifecycleError("EVENT_STRUCTURE_LOCKED", `This event is ${existing.status}; its competition structure can no longer be replaced.`, 409);
    }

    if (existing) {
      const existingDivisions = await tx.select({ id: divisions.id }).from(divisions).where(eq(divisions.tournamentId, existing.id));
      if (existingDivisions.length > 0) {
        const existingRegistrations = await tx.select({ id: registrations.id }).from(registrations)
          .where(inArray(registrations.divisionId, existingDivisions.map((division) => division.id))).limit(1);
        if (existingRegistrations.length > 0) {
          throw new LifecycleError("EVENT_HAS_REGISTRATIONS", "Competition structure is locked because signups already exist. Manage entrants from the event detail page.", 409);
        }
        await tx.delete(divisions).where(eq(divisions.tournamentId, existing.id));
      }
    }

    const tournamentValues = {
      name: draft.name,
      description: draft.description,
      startsAt: eventDate(draft.startsAt),
      endsAt: eventDate(draft.endsAt),
      online: draft.location.trim().toLowerCase() === "online",
      bannerUrl: draft.imageUrl || null,
      hasBracket: draft.hasBracket,
      youtubeUrl: draft.youtubeUrl?.trim() || null,
      updatedAt: new Date(),
    };
    const [event] = existing
      ? await tx.update(tournaments).set(tournamentValues).where(eq(tournaments.id, existing.id)).returning()
      : await tx.insert(tournaments).values({ slug: draft.slug, status: "draft", ...tournamentValues }).returning();

    const lifecycleCompetitions: AdminLifecycleCompetition[] = [];
    for (const competition of draft.competitions) {
      // Games come from the catalogue only: silently creating one here used to
      // put placeholder rows on the public site.
      const [game] = await tx.select().from(games).where(eq(games.slug, competition.gameSlug)).limit(1);
      if (!game) {
        throw new LifecycleError(
          "GAME_NOT_FOUND",
          `"${competition.name}" refers to a game that is not in the catalogue. Add it under Games first.`,
          422,
        );
      }
      const participantType = competition.competitionType === "league" ? "team" as const : "gamer" as const;
      const maxParticipants = competition.competitionType === "league" ? competition.leagueTeamCount : competition.maxEntries;
      const [division] = await tx.insert(divisions).values({
        tournamentId: event.id,
        gameId: game.id,
        name: competition.name,
        competitionType: competition.competitionType,
        status: "draft",
        participantType,
        maxParticipants,
        registrationRestricted: competition.competitionType === "tournament" && competition.registrationRestricted,
        registrationLimit: competition.competitionType === "tournament" && competition.registrationRestricted ? competition.registrationLimit : null,
        rosterMin: competition.competitionType === "league" ? competition.playersPerTeam : 1,
        rosterMax: competition.competitionType === "league" ? competition.playersPerTeam : 1,
      }).returning();
      await tx.insert(stages).values(competition.stages.map((stage, index) => ({
        divisionId: division.id,
        name: stage.format === "groups" ? `Stage ${index + 1} · Groups` : stage.format === "single-elimination" ? `Stage ${index + 1} · Single Elimination` : `Stage ${index + 1} · Double Elimination`,
        sequence: index + 1,
        format: databaseStageFormat(stage.format),
        status: "draft" as const,
        configuration: stage.format === "groups"
          ? { groups: stage.groups, advancePerGroup: stage.advancePerGroup, legs: 1, bestOf: stage.bestOf }
          : { bestOf: stage.bestOf, grandFinalReset: stage.grandFinalReset },
      })));
      lifecycleCompetitions.push({
        tournamentId: event.id,
        divisionId: division.id,
        name: division.name,
        game: game.name,
        status: "DRAFT",
        actualParticipants: 0,
        totalMatches: 0,
        unfinishedMatches: 0,
      });
    }

    await tx.insert(auditEvents).values({
      actorUserId: context.actorUserId,
      action: existing ? "tournament.draft_updated" : "tournament.draft_created",
      entityType: "tournament",
      entityId: event.id,
      requestId: context.requestId,
      metadata: { slug: draft.slug, competitions: draft.competitions.length },
    });
    return { tournamentId: event.id, slug: event.slug, lifecycleCompetitions };
  });
}

const testEntrantNames = ["Nova", "Viper", "Raven", "Frost", "Blaze", "Phantom", "Titan", "Storm", "Reaper", "Pulse", "Shadow", "Ace", "Flux", "Venom", "Onyx", "Drift"];

export async function addTestEntrantsToDivision(
  divisionId: string,
  count: number,
  context: { actorUserId: string; requestId?: string },
) {
  return db.transaction(async (tx) => {
    const [division] = await tx.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1);
    if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game tournament was not found.", 404);
    if (["live", "completed", "cancelled", "archived"].includes(division.status)) {
      throw new LifecycleError("DIVISION_NOT_STARTABLE", `Test signups cannot be added while the game tournament is ${division.status}.`, 409);
    }
    const existing = await tx.select({ id: registrations.id }).from(registrations).where(eq(registrations.divisionId, divisionId)).limit(1);
    if (existing.length > 0) {
      throw new LifecycleError("SIGNUPS_ALREADY_EXIST", "Test signups can only be generated when the competition has no registrations.", 409);
    }
    const safeCount = Math.min(Math.max(2, count), division.maxParticipants);
    const checkedInAt = new Date();
    await tx.insert(registrations).values(Array.from({ length: safeCount }, (_, index) => ({
      divisionId,
      participantId: crypto.randomUUID(),
      participantType: division.participantType,
      status: "confirmed" as const,
      displayNameSnapshot: `${testEntrantNames[index % testEntrantNames.length]}${index >= testEntrantNames.length ? ` ${Math.floor(index / testEntrantNames.length) + 1}` : ""}`,
      seed: index + 1,
      checkedInAt,
      eligible: true,
      rosterSnapshot: division.participantType === "team"
        ? Array.from({ length: division.rosterMin }, (_, playerIndex) => ({ name: `Player ${playerIndex + 1}` }))
        : [],
    })));
    await tx.update(divisions).set({ status: "registration_closed", updatedAt: checkedInAt }).where(eq(divisions.id, divisionId));
    await tx.update(tournaments).set({ status: "registration_closed", updatedAt: checkedInAt }).where(eq(tournaments.id, division.tournamentId));
    await tx.insert(auditEvents).values({
      actorUserId: context.actorUserId,
      action: "division.test_signups_generated",
      entityType: "division",
      entityId: divisionId,
      requestId: context.requestId,
      metadata: { count: safeCount },
    });
    return { divisionId, actualParticipants: safeCount, status: "READY" as const };
  });
}
