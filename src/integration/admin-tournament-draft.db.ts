import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { auditEvents, divisions, games, matches, stages, tournaments, users } from "@/db/schema";
import { addTestEntrantsToDivision, saveTournamentDraftToDatabase } from "@/lib/admin-tournament-draft";
import { createGameCompetition, createStage } from "@/lib/tournament-draft";
import { getDivisionPreviewTx, startDivision, startMatch } from "@/lib/tournament-lifecycle";

describe("admin tournament draft lifecycle against PostgreSQL", () => {
  it("persists a filled builder draft, adds rehearsal signups, validates, and starts", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const slug = `builder-lifecycle-${suffix}`;
    const gameSlug = `builder-game-${suffix}`;
    const [actor] = await db.insert(users).values({ status: "active" }).returning();
    let tournamentId: string | undefined;
    let divisionId: string | undefined;

    try {
      const saved = await saveTournamentDraftToDatabase({
        slug,
        name: `Builder Lifecycle ${suffix}`,
        description: "Integration validation",
        imageUrl: "",
        imageAlt: "",
        startsAt: "2027-08-18",
        endsAt: "2027-08-24",
        location: "Karachi",
        attachments: [],
        competitions: [createGameCompetition("competition-1", {
          name: "Integration Open",
          gameSlug,
          maxEntries: 8,
          stages: [createStage("stage-1", "double-elimination")],
        })],
      }, { actorUserId: actor.id });
      tournamentId = saved.tournamentId;
      divisionId = saved.lifecycleCompetitions[0].divisionId;
      expect(saved.lifecycleCompetitions[0]).toMatchObject({ status: "DRAFT", actualParticipants: 0 });

      const [persistedStage] = await db.select().from(stages).where(eq(stages.divisionId, divisionId));
      expect(persistedStage).toMatchObject({ format: "double_elimination", status: "draft" });

      await addTestEntrantsToDivision(divisionId, 8, { actorUserId: actor.id });
      const preview = await db.transaction((tx) => getDivisionPreviewTx(tx, divisionId as string));
      expect(preview.validation).toMatchObject({ valid: true, actualParticipants: 8, generatedSize: 8 });
      expect(preview.bracket?.format).toBe("double_elimination");

      await expect(startDivision(divisionId, { actorUserId: actor.id })).resolves.toMatchObject({ status: "live", actualParticipants: 8, generatedSize: 8 });
      const [startedDivision] = await db.select().from(divisions).where(eq(divisions.id, divisionId));
      expect(startedDivision.status).toBe("live");
      const persistedMatches = await db.select().from(matches).where(eq(matches.stageId, persistedStage.id));
      expect(persistedMatches).not.toHaveLength(0);
      const readyMatch = persistedMatches.find((match) => match.status === "ready");
      expect(readyMatch).toBeDefined();
      await expect(startMatch(readyMatch!.id, { actorUserId: actor.id })).resolves.toMatchObject({ status: "live" });
      const [startedMatch] = await db.select().from(matches).where(eq(matches.id, readyMatch!.id));
      expect(startedMatch.status).toBe("live");
    } finally {
      const entityIds = [tournamentId, divisionId].filter((id): id is string => Boolean(id));
      if (entityIds.length) await db.delete(auditEvents).where(inArray(auditEvents.entityId, entityIds));
      if (tournamentId) await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
      await db.delete(games).where(eq(games.slug, gameSlug));
      await db.delete(auditEvents).where(eq(auditEvents.actorUserId, actor.id));
      await db.delete(users).where(eq(users.id, actor.id));
    }
  });
});
