import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { divisions, games, matches, mediaAssets, registrations, stages, tournamentMedia, tournaments } from "@/db/schema";
import type { AdminEvent, AdminLifecycleCompetition } from "@/lib/admin-events";
import { mediaUrlForKey } from "@/lib/object-storage";
import type { StageFormat } from "@/lib/tournament-draft";

function eventStatus(status: typeof tournaments.$inferSelect.status): AdminEvent["status"] {
  if (status === "completed" || status === "archived") return "COMPLETED";
  if (status === "live") return "LIVE";
  if (status === "registration_open") return "REGISTRATION OPEN";
  if (status === "registration_closed" || status === "published") return "READY";
  return "DRAFT";
}

function stageFormat(format: typeof stages.$inferSelect.format): StageFormat {
  if (format === "single_elimination") return "single-elimination";
  if (format === "double_elimination") return "double-elimination";
  return "groups";
}

export async function getAdminEventFromDatabase(slug: string): Promise<{
  event: AdminEvent;
  lifecycleCompetitions: AdminLifecycleCompetition[];
} | null> {
  const [event] = await db.select().from(tournaments).where(eq(tournaments.slug, slug)).limit(1);
  if (!event) return null;
  const gameCompetitions = await db.select({ division: divisions, game: games }).from(divisions)
    .innerJoin(games, eq(games.id, divisions.gameId)).where(eq(divisions.tournamentId, event.id));
  const divisionIds = gameCompetitions.map((item) => item.division.id);
  const eventRegistrations = divisionIds.length
    ? await db.select().from(registrations).where(inArray(registrations.divisionId, divisionIds))
    : [];
  const eventStages = divisionIds.length
    ? await db.select().from(stages).where(inArray(stages.divisionId, divisionIds))
    : [];
  const stageIds = eventStages.map((stage) => stage.id);
  const eventMatches = stageIds.length
    ? await db.select().from(matches).where(inArray(matches.stageId, stageIds))
    : [];
  const galleryRows = await db.select({
    id: tournamentMedia.id,
    caption: tournamentMedia.caption,
    createdAt: tournamentMedia.createdAt,
    objectKey: mediaAssets.objectKey,
    mimeType: mediaAssets.mimeType,
    sizeBytes: mediaAssets.sizeBytes,
    altText: mediaAssets.altText,
  }).from(tournamentMedia)
    .innerJoin(mediaAssets, eq(mediaAssets.id, tournamentMedia.mediaAssetId))
    .where(eq(tournamentMedia.tournamentId, event.id))
    .orderBy(asc(tournamentMedia.sequence), asc(tournamentMedia.createdAt));
  const status = eventStatus(event.status);

  const adminEvent: AdminEvent = {
    id: event.id,
    slug: event.slug,
    name: event.name,
    description: event.description ?? "Multi-game competitive event.",
    imageUrl: event.bannerUrl ?? undefined,
    date: event.startsAt && event.endsAt
      ? `${event.startsAt.toLocaleDateString("en-PK")} – ${event.endsAt.toLocaleDateString("en-PK")}`
      : "Not scheduled",
    startsAt: event.startsAt?.toISOString().slice(0, 10) ?? "",
    endsAt: event.endsAt?.toISOString().slice(0, 10) ?? "",
    createdAt: event.createdAt.toISOString(),
    location: event.online ? "Online" : "Venue event",
    hasBracket: event.hasBracket,
    youtubeUrl: event.youtubeUrl,
    status,
    galleryImages: galleryRows.map((row) => ({
      id: row.id,
      key: row.objectKey,
      url: mediaUrlForKey(row.objectKey),
      name: row.caption ?? row.altText ?? "Event image",
      altText: row.altText ?? row.caption ?? "",
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedAt: row.createdAt.toISOString(),
    })),
    competitions: gameCompetitions.map(({ division, game }) => {
      const divisionRegistrations = eventRegistrations.filter((registration) => registration.divisionId === division.id);
      const divisionStages = eventStages.filter((stage) => stage.divisionId === division.id).sort((left, right) => left.sequence - right.sequence);
      return {
        id: division.id,
        tournamentId: event.id,
        name: division.name,
        gameSlug: game.slug,
        game: game.name,
        type: division.competitionType,
        status: eventStatus(division.status),
        capacity: division.maxParticipants,
        registrationRestricted: division.registrationRestricted,
        registrationLimit: division.registrationLimit ?? undefined,
        stages: divisionStages.map((stage) => stageFormat(stage.format)),
        participants: divisionRegistrations.map((registration) => ({
          id: registration.participantId,
          registrationId: registration.id,
          handle: registration.displayNameSnapshot,
          name: registration.displayNameSnapshot,
          registrationStatus: registration.status === "rejected" || registration.status === "withdrawn" ? "declined" as const : registration.eligible ? "confirmed" as const : "pending" as const,
          paymentStatus: "not_required" as const,
          accountStatus: "active" as const,
        })),
      };
    }),
  };

  const lifecycleCompetitions = gameCompetitions.map(({ division, game }) => {
    const divisionStages = eventStages.filter((stage) => stage.divisionId === division.id);
    const divisionStageIds = new Set(divisionStages.map((stage) => stage.id));
    const divisionMatches = eventMatches.filter((match) => divisionStageIds.has(match.stageId));
    return {
      tournamentId: event.id,
      divisionId: division.id,
      name: division.name,
      game: game.name,
      status: eventStatus(division.status),
      actualParticipants: eventRegistrations.filter((registration) =>
        registration.divisionId === division.id
        && (registration.status === "registered" || registration.status === "confirmed")
        && registration.eligible
        && registration.checkedInAt !== null).length,
      totalMatches: divisionMatches.length,
      unfinishedMatches: divisionMatches.filter((match) => !["final", "forfeit", "cancelled"].includes(match.status)).length,
    } satisfies AdminLifecycleCompetition;
  });
  return { event: adminEvent, lifecycleCompetitions };
}

export async function getAdminEventsFromDatabase() {
  const eventRows = await db.select().from(tournaments);
  const competitionRows = eventRows.length
    ? await db.select({ division: divisions, game: games }).from(divisions)
        .innerJoin(games, eq(games.id, divisions.gameId))
        .where(inArray(divisions.tournamentId, eventRows.map((event) => event.id)))
    : [];
  return eventRows.map((event) => ({
    slug: event.slug,
    name: event.name,
    description: event.description ?? "Multi-game competitive event.",
    imageUrl: event.bannerUrl ?? undefined,
    date: event.startsAt && event.endsAt
      ? `${event.startsAt.toLocaleDateString("en-PK")} – ${event.endsAt.toLocaleDateString("en-PK")}`
      : "Not scheduled",
    startsAt: event.startsAt?.toISOString().slice(0, 10) ?? "",
    endsAt: event.endsAt?.toISOString().slice(0, 10) ?? "",
    createdAt: event.createdAt.toISOString(),
    location: event.online ? "Online" : "Venue event",
    hasBracket: event.hasBracket,
    youtubeUrl: event.youtubeUrl,
    status: eventStatus(event.status),
    competitions: competitionRows.filter((item) => item.division.tournamentId === event.id).map(({ division, game }) => ({
      id: division.id,
      name: division.name,
      gameSlug: game.slug,
      game: game.name,
      type: division.competitionType,
      status: eventStatus(division.status),
      capacity: division.maxParticipants,
      registrationRestricted: division.registrationRestricted,
      registrationLimit: division.registrationLimit ?? undefined,
      stages: [],
      participants: [],
    })),
  } satisfies AdminEvent));
}
