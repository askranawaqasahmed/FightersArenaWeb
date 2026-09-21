import "server-only";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  divisions,
  gamerProfiles,
  games,
  tournamentParticipantSnapshots,
  tournaments,
} from "@/db/schema";
import { LifecycleError } from "@/domain/tournament-lifecycle";

export type PlacementInput = {
  gamerId: string;
  finalRank: number | null;
  placementLabel?: string | null;
};

export async function listDivisionPlacements(tournamentSlug: string) {
  const rows = await db.select({
    divisionId: divisions.id,
    divisionName: divisions.name,
    gameName: games.name,
    participantId: tournamentParticipantSnapshots.participantId,
    displayName: tournamentParticipantSnapshots.displayName,
    finalRank: tournamentParticipantSnapshots.finalRank,
    placementLabel: tournamentParticipantSnapshots.placementLabel,
    gamerSlug: gamerProfiles.slug,
  })
    .from(divisions)
    .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
    .innerJoin(games, eq(games.id, divisions.gameId))
    .leftJoin(tournamentParticipantSnapshots, eq(tournamentParticipantSnapshots.divisionId, divisions.id))
    .leftJoin(gamerProfiles, eq(gamerProfiles.id, tournamentParticipantSnapshots.participantId))
    .where(eq(tournaments.slug, tournamentSlug))
    .orderBy(asc(divisions.createdAt), sql`${tournamentParticipantSnapshots.finalRank} asc nulls last`);

  const byDivision = new Map<string, {
    divisionId: string;
    divisionName: string;
    gameName: string;
    placements: Array<{ gamerId: string; gamerSlug: string | null; displayName: string; finalRank: number | null; placementLabel: string | null }>;
  }>();

  for (const row of rows) {
    const entry = byDivision.get(row.divisionId) ?? {
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      gameName: row.gameName,
      placements: [],
    };
    if (row.participantId && row.displayName) {
      entry.placements.push({
        gamerId: row.participantId,
        gamerSlug: row.gamerSlug,
        displayName: row.displayName,
        finalRank: row.finalRank,
        placementLabel: row.placementLabel,
      });
    }
    byDivision.set(row.divisionId, entry);
  }
  return [...byDivision.values()];
}

/**
 * Replaces the recorded placements for one competition.
 * Used for events that have no bracket, where results are entered by hand.
 */
export async function replaceDivisionPlacements(
  divisionId: string,
  placements: PlacementInput[],
  actorUserId: string,
) {
  return db.transaction(async (tx) => {
    const [division] = await tx.select({
      id: divisions.id,
      tournamentId: divisions.tournamentId,
      hasBracket: tournaments.hasBracket,
      slug: tournaments.slug,
    })
      .from(divisions)
      .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
      .where(eq(divisions.id, divisionId))
      .limit(1);
    if (!division) return null;
    if (division.hasBracket) {
      throw new LifecycleError(
        "BRACKET_EVENT",
        "This event runs a bracket, so results come from its matches. Switch it to results-only to enter placements by hand.",
        409,
      );
    }

    const gamerIds = placements.map((placement) => placement.gamerId);
    const profiles = gamerIds.length
      ? await tx.select({ id: gamerProfiles.id, handle: gamerProfiles.handle })
        .from(gamerProfiles)
        .where(inArray(gamerProfiles.id, gamerIds))
      : [];
    const handleById = new Map(profiles.map((profile) => [profile.id, profile.handle]));
    for (const placement of placements) {
      if (!handleById.has(placement.gamerId)) {
        throw new LifecycleError("GAMER_NOT_FOUND", "One of the selected players no longer exists.", 422);
      }
    }

    await tx.delete(tournamentParticipantSnapshots).where(eq(tournamentParticipantSnapshots.divisionId, divisionId));
    if (placements.length > 0) {
      await tx.insert(tournamentParticipantSnapshots).values(placements.map((placement) => ({
        tournamentId: division.tournamentId,
        divisionId,
        participantId: placement.gamerId,
        participantType: "gamer" as const,
        displayName: handleById.get(placement.gamerId) as string,
        finalRank: placement.finalRank,
        placementLabel: placement.placementLabel ?? null,
        profileSnapshot: { source: "admin-entry" },
      })));
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "tournament.placements_recorded",
      entityType: "division",
      entityId: divisionId,
      metadata: { slug: division.slug, placements: placements.length },
    });
    return { divisionId, placements: placements.length };
  });
}
