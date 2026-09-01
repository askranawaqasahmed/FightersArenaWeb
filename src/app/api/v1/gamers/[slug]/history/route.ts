import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  divisions,
  gamerProfiles,
  games,
  sponsors,
  sponsorships,
  tournamentParticipantSnapshots,
  tournaments,
} from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const [gamer] = await db.select({ id: gamerProfiles.id }).from(gamerProfiles)
      .where(eq(gamerProfiles.slug, slug)).limit(1);
    if (!gamer) return apiProblem(404, "GAMER_NOT_FOUND", "Not found", "The player profile was not found.");

    const [sponsorHistory, tournamentHistory] = await Promise.all([
      db.select({
        sponsorshipId: sponsorships.id,
        status: sponsorships.status,
        startsAt: sponsorships.startsAt,
        endsAt: sponsorships.endsAt,
        sponsorId: sponsors.id,
        sponsorName: sponsors.name,
        sponsorSlug: sponsors.slug,
        sponsorLogoUrl: sponsors.logoUrl,
      }).from(sponsorships).innerJoin(sponsors, eq(sponsors.id, sponsorships.sponsorId)).where(and(
        eq(sponsorships.subjectType, "gamer"),
        eq(sponsorships.subjectId, gamer.id),
        eq(sponsorships.public, true),
      )).orderBy(asc(sponsorships.startsAt)),
      db.select({
        tournamentId: tournaments.id,
        tournamentName: tournaments.name,
        tournamentSlug: tournaments.slug,
        divisionName: divisions.name,
        gameName: games.name,
        finalRank: tournamentParticipantSnapshots.finalRank,
        displayName: tournamentParticipantSnapshots.displayName,
        sponsors: tournamentParticipantSnapshots.sponsorSnapshot,
        capturedAt: tournamentParticipantSnapshots.capturedAt,
      }).from(tournamentParticipantSnapshots)
        .innerJoin(tournaments, eq(tournaments.id, tournamentParticipantSnapshots.tournamentId))
        .innerJoin(divisions, eq(divisions.id, tournamentParticipantSnapshots.divisionId))
        .innerJoin(games, eq(games.id, divisions.gameId))
        .where(eq(tournamentParticipantSnapshots.participantId, gamer.id))
        .orderBy(asc(tournamentParticipantSnapshots.capturedAt)),
    ]);
    return apiData({ sponsorships: sponsorHistory, tournaments: tournamentHistory });
  } catch (error) {
    return invalidInput(error);
  }
}
