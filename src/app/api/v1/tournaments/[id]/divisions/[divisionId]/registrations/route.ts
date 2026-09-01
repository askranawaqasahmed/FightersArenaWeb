import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { divisions, gamerProfiles, registrations, tournaments } from "@/db/schema";
import { apiData, apiProblem, invalidInput } from "@/lib/api";
import { resolveParticipantLinks } from "@/lib/public-gamer-data";
import { publicTournamentStatuses, resolveTournamentId } from "@/lib/public-tournament-data";
import { getRequestGamer } from "@/lib/request-auth";
import { getDivisionAvailabilityTx, registerParticipantTx } from "@/lib/tournament-lifecycle";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const { id, divisionId } = await params;
    const tournamentId = await resolveTournamentId(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    if (!tournamentId) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");

    const [division] = await db.select({ id: divisions.id, status: tournaments.status })
      .from(divisions)
      .innerJoin(tournaments, eq(tournaments.id, divisions.tournamentId))
      .where(and(eq(divisions.id, parsedDivisionId), eq(divisions.tournamentId, tournamentId)))
      .limit(1);
    if (!division || !publicTournamentStatuses.includes(division.status as typeof publicTournamentStatuses[number])) {
      return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game competition does not belong to this event.");
    }

    const rows = await db.select({
      id: registrations.id,
      displayName: registrations.displayNameSnapshot,
      participantId: registrations.participantId,
      participantType: registrations.participantType,
      status: registrations.status,
      seed: registrations.seed,
      createdAt: registrations.createdAt,
      avatarUrl: gamerProfiles.avatarUrl,
    }).from(registrations)
      .leftJoin(gamerProfiles, and(eq(gamerProfiles.id, registrations.participantId), eq(registrations.participantType, "gamer")))
      .where(and(
        eq(registrations.divisionId, parsedDivisionId),
        inArray(registrations.status, ["registered", "confirmed"]),
      ))
      .orderBy(sql`${registrations.seed} asc nulls last`, asc(registrations.createdAt));

    const links = await resolveParticipantLinks(rows.map((row) => ({ id: row.participantId, type: row.participantType })));
    return apiData({
      registrations: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        participantType: row.participantType,
        status: row.status,
        confirmed: row.status === "confirmed",
        seed: row.seed,
        avatarUrl: row.avatarUrl,
        profileSlug: links.get(row.participantId)?.slug ?? null,
        registeredAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return invalidInput(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; divisionId: string }> }) {
  try {
    const account = await getRequestGamer(request);
    if (!account) return apiProblem(401, "AUTH_REQUIRED", "Authentication required", "Sign in with a player account to register.");
    const { id, divisionId } = await params;
    const tournamentId = await resolveTournamentId(id);
    const parsedDivisionId = z.uuid().parse(divisionId);
    if (!tournamentId) return apiProblem(404, "TOURNAMENT_NOT_FOUND", "Not found", "The event was not found.");
    const result = await db.transaction(async (tx) => {
      const [division] = await tx.select({ id: divisions.id, participantType: divisions.participantType }).from(divisions).where(and(
        eq(divisions.id, parsedDivisionId),
        eq(divisions.tournamentId, tournamentId),
      )).limit(1);
      if (!division) return null;
      if (division.participantType !== "gamer") return { teamRegistrationRequired: true as const };
      const [profile] = await tx.select().from(gamerProfiles).where(eq(gamerProfiles.userId, account.userId)).limit(1);
      if (!profile) return { profileRequired: true as const };
      const registration = await registerParticipantTx(tx, {
        divisionId: parsedDivisionId,
        participantId: profile.id,
        participantType: "gamer",
        displayName: profile.displayName,
      });
      return { registration, availability: await getDivisionAvailabilityTx(tx, parsedDivisionId) };
    });
    if (!result) return apiProblem(404, "DIVISION_NOT_FOUND", "Not found", "The game competition does not belong to this event.");
    if ("teamRegistrationRequired" in result) return apiProblem(422, "TEAM_REGISTRATION_REQUIRED", "Team registration required", "This competition accepts teams rather than individual players.");
    if ("profileRequired" in result) return apiProblem(422, "GAMER_PROFILE_REQUIRED", "Player profile required", "Create a player profile before registering.");
    return apiData(result, { status: 201 });
  } catch (error) {
    return invalidInput(error);
  }
}
