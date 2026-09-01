import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditEvents,
  divisions,
  gamerProfiles,
  matchSides,
  matches,
  outboxEvents,
  registrations,
  rounds,
  sponsors,
  sponsorships,
  stageParticipants,
  stages,
  standings,
  teams,
  tournamentParticipantSnapshots,
  tournaments,
} from "@/db/schema";
import { compareBracketMatchOrder } from "@/lib/bracket-match-order";
import {
  generateDoubleElimination,
  generateRoundRobin,
  generateSingleElimination,
  type Bracket,
  type Participant,
  type SlotSource,
} from "@/domain/tournament-engine";
import {
  assertMatchTransition,
  assertTournamentTransition,
  getRegistrationAvailability,
  LifecycleError,
  resolveActualEntrants,
  tournamentActionTargetStatus,
  validateRegistrationPolicy,
  type MatchLifecycleStatus,
  type TournamentRegistrationAction,
} from "@/domain/tournament-lifecycle";

export type LifecycleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ActorContext = {
  actorUserId?: string;
  requestId?: string;
};

const activeRegistrationStatuses = ["registered", "confirmed"] as const;
const finishedMatchStatuses = new Set<MatchLifecycleStatus>(["final", "forfeit", "cancelled"]);

async function audit(
  tx: LifecycleTransaction,
  context: ActorContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx.insert(auditEvents).values({
    actorUserId: context.actorUserId,
    action,
    entityType,
    entityId,
    requestId: context.requestId,
    metadata,
  });
}

export async function setRegistrationPolicyTx(
  tx: LifecycleTransaction,
  divisionId: string,
  restricted: boolean,
  limit: number | null,
  context: ActorContext = {},
) {
  const policy = validateRegistrationPolicy({ restricted, limit });
  const [division] = await tx.select({ id: divisions.id, tournamentId: divisions.tournamentId, status: divisions.status }).from(divisions).where(eq(divisions.id, divisionId)).limit(1);
  if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game competition was not found.", 404);
  if (["live", "completed", "cancelled", "archived"].includes(division.status)) {
    throw new LifecycleError("REGISTRATION_POLICY_LOCKED", "Registration policy cannot change after this game tournament has started.");
  }
  const [registeredCount] = await tx.select({ value: count() }).from(registrations).where(and(
    eq(registrations.divisionId, divisionId),
    inArray(registrations.status, [...activeRegistrationStatuses]),
  ));
  if (policy.restricted && Number(registeredCount.value) > policy.limit) {
    throw new LifecycleError("LIMIT_BELOW_REGISTRATIONS", `The limit cannot be lower than the ${registeredCount.value} active registrations.`, 422);
  }

  const [updated] = await tx.update(divisions).set({
    registrationRestricted: policy.restricted,
    registrationLimit: policy.limit,
    updatedAt: new Date(),
  }).where(eq(divisions.id, divisionId)).returning({
    id: divisions.id,
    registrationRestricted: divisions.registrationRestricted,
    registrationLimit: divisions.registrationLimit,
  });
  await audit(tx, context, "division.registration_policy_changed", "division", divisionId, policy);
  return updated;
}

export async function setRegistrationPolicy(
  divisionId: string,
  restricted: boolean,
  limit: number | null,
  context: ActorContext = {},
) {
  return db.transaction((tx) => setRegistrationPolicyTx(tx, divisionId, restricted, limit, context));
}

export async function getDivisionAvailabilityTx(tx: LifecycleTransaction, divisionId: string) {
  const [division] = await tx.select({
    id: divisions.id,
    restricted: divisions.registrationRestricted,
    limit: divisions.registrationLimit,
  }).from(divisions).where(eq(divisions.id, divisionId)).limit(1);
  if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game competition was not found.", 404);

  const [registrationCount] = await tx.select({ value: count() }).from(registrations).where(and(
    eq(registrations.divisionId, divisionId),
    inArray(registrations.status, [...activeRegistrationStatuses]),
  ));
  return getRegistrationAvailability(
    { restricted: division.restricted, limit: division.limit },
    Number(registrationCount.value),
  );
}

export async function registerParticipantTx(
  tx: LifecycleTransaction,
  input: {
    divisionId: string;
    participantId: string;
    participantType: "gamer" | "team";
    displayName: string;
    rosterSnapshot?: Array<Record<string, unknown>>;
  },
) {
  const [division] = await tx.select({
    id: divisions.id,
    tournamentId: divisions.tournamentId,
    restricted: divisions.registrationRestricted,
    limit: divisions.registrationLimit,
  }).from(divisions).where(eq(divisions.id, input.divisionId)).for("update").limit(1);
  if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game competition was not found.", 404);

  const [tournament] = await tx.select({ status: tournaments.status }).from(tournaments)
    .where(eq(tournaments.id, division.tournamentId)).limit(1);
  if (tournament?.status !== "registration_open") {
    throw new LifecycleError("REGISTRATION_CLOSED", "Registration is not open for this event.");
  }

  const [existing] = await tx.select({ id: registrations.id, status: registrations.status }).from(registrations).where(and(
    eq(registrations.divisionId, input.divisionId),
    eq(registrations.participantId, input.participantId),
  )).limit(1);
  if (existing && existing.status !== "withdrawn") {
    throw new LifecycleError("ALREADY_REGISTERED", "This participant is already registered for the game competition.");
  }

  const availability = await getDivisionAvailabilityTx(tx, input.divisionId);
  if (availability.full) throw new LifecycleError("SLOTS_FULL", "All restricted registration slots are full.");

  if (existing) {
    const [reactivated] = await tx.update(registrations).set({
      status: "registered",
      eligible: false,
      checkedInAt: null,
      seed: null,
      displayNameSnapshot: input.displayName.trim(),
      rosterSnapshot: input.rosterSnapshot ?? [],
      updatedAt: new Date(),
    }).where(eq(registrations.id, existing.id)).returning();
    return reactivated;
  }

  const [created] = await tx.insert(registrations).values({
    divisionId: input.divisionId,
    participantId: input.participantId,
    participantType: input.participantType,
    displayNameSnapshot: input.displayName.trim(),
    rosterSnapshot: input.rosterSnapshot ?? [],
  }).returning();
  return created;
}

async function persistBracketTx(tx: LifecycleTransaction, stageId: string, bracket: Bracket) {
  for (const generatedRound of bracket.rounds) {
    const [round] = await tx.insert(rounds).values({
      stageId,
      sequence: generatedRound.sequence,
      label: generatedRound.label,
      bracketLane: generatedRound.lane,
    }).returning({ id: rounds.id });
    for (const [matchIndex, generatedMatch] of generatedRound.matches.entries()) {
      const [match] = await tx.insert(matches).values({
        stageId,
        roundId: round.id,
        code: generatedMatch.code,
        sequence: matchIndex + 1,
        bestOf: generatedMatch.bestOf,
      }).returning({ id: matches.id });
      await tx.insert(matchSides).values(generatedMatch.slots.map((slot, slotIndex) => ({
        matchId: match.id,
        slot: slotIndex + 1,
        ...slotValues(slot),
      })));
    }
  }
}

function slotValues(slot: SlotSource) {
  if (slot.type === "participant") {
    return {
      participantId: slot.participant.id,
      displayNameSnapshot: slot.participant.name,
      sourceMatchCode: null,
      sourceOutcome: null,
    };
  }
  if (slot.type === "match") {
    return {
      participantId: null,
      displayNameSnapshot: null,
      sourceMatchCode: slot.matchCode,
      sourceOutcome: slot.outcome,
    };
  }
  return { participantId: null, displayNameSnapshot: null, sourceMatchCode: null, sourceOutcome: null };
}

async function persistRoundRobinTx(
  tx: LifecycleTransaction,
  stageId: string,
  participants: Participant[],
  legs: number,
  bestOf: number,
) {
  const fixtures = generateRoundRobin(participants, legs);
  const roundNumbers = [...new Set(fixtures.map((fixture) => fixture.round))];
  for (const roundNumber of roundNumbers) {
    const [round] = await tx.insert(rounds).values({
      stageId,
      sequence: roundNumber,
      label: `Round ${roundNumber}`,
      bracketLane: "main",
    }).returning({ id: rounds.id });
    const roundFixtures = fixtures.filter((fixture) => fixture.round === roundNumber);
    for (const [fixtureIndex, fixture] of roundFixtures.entries()) {
      const [match] = await tx.insert(matches).values({
        stageId,
        roundId: round.id,
        code: `RR${roundNumber}-M${fixtureIndex + 1}`,
        sequence: fixtureIndex + 1,
        bestOf,
        status: "ready",
      }).returning({ id: matches.id });
      await tx.insert(matchSides).values([
        { matchId: match.id, slot: 1, participantId: fixture.home.id, displayNameSnapshot: fixture.home.name },
        { matchId: match.id, slot: 2, participantId: fixture.away.id, displayNameSnapshot: fixture.away.name },
      ]);
    }
  }
}

async function propagateMatchOutcomeTx(
  tx: LifecycleTransaction,
  stageId: string,
  matchCode: string,
  winnerId: string | null,
  loserId: string | null,
  names: Map<string, string>,
) {
  const dependentMatches = await tx.select({ id: matches.id }).from(matches)
    .where(eq(matches.stageId, stageId));
  if (dependentMatches.length === 0) return;
  const dependentIds = dependentMatches.map((match) => match.id);
  const dependentSides = await tx.select().from(matchSides).where(and(
    inArray(matchSides.matchId, dependentIds),
    eq(matchSides.sourceMatchCode, matchCode),
  ));
  for (const side of dependentSides) {
    const participantId = side.sourceOutcome === "winner" ? winnerId : loserId;
    await tx.update(matchSides).set({
      participantId,
      displayNameSnapshot: participantId ? names.get(participantId) ?? null : null,
    }).where(eq(matchSides.id, side.id));
  }
}

async function refreshStageReadinessTx(tx: LifecycleTransaction, stageId: string) {
  let changed = true;
  while (changed) {
    changed = false;
    const stageMatches = await tx.select({
      id: matches.id,
      code: matches.code,
      status: matches.status,
    }).from(matches).where(eq(matches.stageId, stageId));
    const matchIds = stageMatches.map((match) => match.id);
    if (matchIds.length === 0) return;
    const sides = await tx.select().from(matchSides).where(inArray(matchSides.matchId, matchIds));
    const statusByCode = new Map(stageMatches.map((match) => [match.code, match.status as MatchLifecycleStatus]));
    const nameByParticipant = new Map(
      sides.filter((side) => side.participantId && side.displayNameSnapshot)
        .map((side) => [side.participantId as string, side.displayNameSnapshot as string]),
    );

    for (const match of stageMatches) {
      if (match.status !== "scheduled") continue;
      const currentSides = sides.filter((side) => side.matchId === match.id);
      const dependenciesResolved = currentSides.every((side) =>
        !side.sourceMatchCode || finishedMatchStatuses.has(statusByCode.get(side.sourceMatchCode) as MatchLifecycleStatus));
      if (!dependenciesResolved) continue;

      const populated = currentSides.filter((side) => side.participantId);
      if (populated.length === 2) {
        await tx.update(matches).set({ status: "ready", updatedAt: new Date() }).where(eq(matches.id, match.id));
        changed = true;
      } else if (populated.length === 1) {
        const winnerId = populated[0].participantId as string;
        await tx.update(matches).set({
          status: "forfeit",
          winnerParticipantId: winnerId,
          resultVersion: 1,
          updatedAt: new Date(),
        }).where(eq(matches.id, match.id));
        await tx.update(matchSides).set({ outcome: "win" }).where(eq(matchSides.id, populated[0].id));
        const emptySide = currentSides.find((side) => !side.participantId);
        if (emptySide) await tx.update(matchSides).set({ outcome: "bye" }).where(eq(matchSides.id, emptySide.id));
        await propagateMatchOutcomeTx(tx, stageId, match.code, winnerId, null, nameByParticipant);
        changed = true;
      } else {
        await tx.update(matches).set({ status: "cancelled", resultVersion: 1, updatedAt: new Date() })
          .where(eq(matches.id, match.id));
        await propagateMatchOutcomeTx(tx, stageId, match.code, null, null, nameByParticipant);
        changed = true;
      }
    }
  }
}

type StartValidationIssue = { code: string; message: string };

async function inspectDivisionStartTx(tx: LifecycleTransaction, divisionId: string) {
  const [division] = await tx.select().from(divisions).where(eq(divisions.id, divisionId)).limit(1);
  if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game tournament was not found.", 404);
  const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, division.tournamentId)).limit(1);
  if (!tournament) throw new LifecycleError("TOURNAMENT_NOT_FOUND", "The parent event was not found.", 404);
  const [stage] = await tx.select().from(stages).where(eq(stages.divisionId, divisionId))
    .orderBy(asc(stages.sequence)).limit(1);
  const divisionRegistrations = await tx.select().from(registrations).where(eq(registrations.divisionId, divisionId));
  const errors: StartValidationIssue[] = [];
  const warnings: StartValidationIssue[] = [];

  if (["live", "completed", "cancelled", "archived"].includes(division.status)) {
    errors.push({ code: "DIVISION_NOT_STARTABLE", message: `${division.name} is already ${division.status}.` });
  }
  if (["completed", "cancelled", "archived"].includes(tournament.status)) {
    errors.push({ code: "EVENT_NOT_STARTABLE", message: `The parent event is ${tournament.status}.` });
  }
  if (!stage) errors.push({ code: "STAGE_REQUIRED", message: "Configure at least one stage before starting." });
  if (stage && !["draft", "seeded"].includes(stage.status)) {
    errors.push({ code: "STAGE_NOT_STARTABLE", message: `The first stage is already ${stage.status}.` });
  }
  if (stage?.format === "custom") {
    errors.push({ code: "CUSTOM_STAGE_UNSUPPORTED", message: "Custom stages require a manually validated fixture graph." });
  }

  const configuration = (stage?.configuration ?? {}) as { bestOf?: number; legs?: number; grandFinalReset?: boolean };
  const bestOf = configuration.bestOf ?? 3;
  if (![1, 3, 5, 7].includes(bestOf)) {
    errors.push({ code: "INVALID_BEST_OF", message: "Series length must be best-of 1, 3, 5, or 7." });
  }
  if (stage?.format === "round_robin" && ![1, 2].includes(configuration.legs ?? 1)) {
    errors.push({ code: "INVALID_ROUND_ROBIN_LEGS", message: "Round robin must use one or two legs." });
  }

  const activeRegistrations = divisionRegistrations.filter((registration) =>
    registration.status === "registered" || registration.status === "confirmed");
  if (division.registrationRestricted && (!division.registrationLimit || division.registrationLimit < 2)) {
    errors.push({ code: "INVALID_REGISTRATION_LIMIT", message: "Restricted registration needs a limit of at least two." });
  }
  if (division.registrationRestricted && division.registrationLimit && activeRegistrations.length > division.registrationLimit) {
    errors.push({ code: "REGISTRATION_LIMIT_EXCEEDED", message: `${activeRegistrations.length} active registrations exceed the ${division.registrationLimit}-slot limit.` });
  }
  const typeMismatch = activeRegistrations.find((registration) => registration.participantType !== division.participantType);
  if (typeMismatch) errors.push({ code: "PARTICIPANT_TYPE_MISMATCH", message: "Every registration must match the game tournament participant type." });

  const eligibleRegistrations = divisionRegistrations.filter((registration) =>
    (registration.status === "registered" || registration.status === "confirmed")
    && registration.eligible
    && registration.checkedInAt !== null);
  if (division.participantType === "team") {
    const invalidRoster = eligibleRegistrations.find((registration) =>
      registration.rosterSnapshot.length < division.rosterMin || registration.rosterSnapshot.length > division.rosterMax);
    if (invalidRoster) {
      errors.push({ code: "INVALID_ROSTER_SIZE", message: `Every checked-in team must contain ${division.rosterMin}–${division.rosterMax} players.` });
    }
  }

  let entrants: Participant[] = [];
  try {
    entrants = resolveActualEntrants(divisionRegistrations);
  } catch (error) {
    errors.push({
      code: error instanceof LifecycleError ? error.code : "INSUFFICIENT_ENTRANTS",
      message: error instanceof Error ? error.message : "At least two eligible, checked-in participants are required.",
    });
  }
  if (division.registrationRestricted && division.registrationLimit && entrants.length > division.registrationLimit) {
    errors.push({ code: "ELIGIBLE_LIMIT_EXCEEDED", message: "Eligible checked-in participants exceed the restricted slot limit." });
  }
  if (tournament.status === "registration_open" || division.status === "registration_open") {
    warnings.push({ code: "REGISTRATION_WILL_CLOSE", message: "Starting this game tournament will close its registration immediately." });
  }

  if (stage) {
    const existingRounds = await tx.select({ value: count() }).from(rounds).where(eq(rounds.stageId, stage.id));
    const existingParticipants = await tx.select({ value: count() }).from(stageParticipants).where(eq(stageParticipants.stageId, stage.id));
    if (Number(existingRounds[0].value) > 0 || Number(existingParticipants[0].value) > 0) {
      errors.push({ code: "FIXTURES_ALREADY_GENERATED", message: "This stage already contains generated participants or fixtures." });
    }
  }

  return { division, tournament, stage, divisionRegistrations, configuration, bestOf, entrants, errors, warnings };
}

export async function validateDivisionStartTx(tx: LifecycleTransaction, divisionId: string) {
  const inspection = await inspectDivisionStartTx(tx, divisionId);
  const generatedSize = inspection.entrants.length < 2
    ? null
    : inspection.stage?.format === "round_robin"
      ? inspection.entrants.length
      : 2 ** Math.ceil(Math.log2(inspection.entrants.length));
  return {
    valid: inspection.errors.length === 0,
    errors: inspection.errors,
    warnings: inspection.warnings,
    actualParticipants: inspection.entrants.length,
    generatedSize,
    stage: inspection.stage ? { id: inspection.stage.id, name: inspection.stage.name, format: inspection.stage.format } : null,
  };
}

export async function startDivisionTx(
  tx: LifecycleTransaction,
  divisionId: string,
  context: ActorContext = {},
) {
  await tx.select({ id: divisions.id }).from(divisions).where(eq(divisions.id, divisionId)).for("update").limit(1);
  const inspection = await inspectDivisionStartTx(tx, divisionId);
  if (inspection.errors.length > 0 || !inspection.stage) {
    throw new LifecycleError("START_VALIDATION_FAILED", inspection.errors.map((issue) => issue.message).join(" ") || "The game tournament cannot start.", 422);
  }
  const { division, tournament, stage, divisionRegistrations, configuration, bestOf, entrants } = inspection;
  let generatedSize = entrants.length;
  await tx.insert(stageParticipants).values(entrants.map((entrant) => {
    const registration = divisionRegistrations.find((item) => item.participantId === entrant.id);
    return {
      stageId: stage.id,
      participantId: entrant.id,
      participantType: registration?.participantType ?? division.participantType,
      displayNameSnapshot: entrant.name,
      seed: entrant.seed,
    };
  }));

  if (stage.format === "round_robin") {
    await persistRoundRobinTx(tx, stage.id, entrants, configuration.legs ?? 1, bestOf);
  } else {
    const bracket = stage.format === "single_elimination"
      ? generateSingleElimination(entrants, { bestOf })
      : generateDoubleElimination(entrants, { bestOf, grandFinalReset: configuration.grandFinalReset });
    generatedSize = bracket.size;
    await persistBracketTx(tx, stage.id, bracket);
    await refreshStageReadinessTx(tx, stage.id);
  }
  await recalculateStandingsTx(tx, stage.id);
  const startedAt = new Date();
  await tx.update(stages).set({
    status: "live",
    lockedAt: startedAt,
    configuration: { ...configuration, actualParticipantCount: entrants.length, generatedBracketSize: generatedSize },
    updatedAt: startedAt,
  }).where(eq(stages.id, stage.id));
  await tx.update(divisions).set({ status: "live", actualStartedAt: startedAt, updatedAt: startedAt })
    .where(eq(divisions.id, divisionId));
  await tx.update(tournaments).set({
    status: "live",
    actualStartedAt: tournament.actualStartedAt ?? startedAt,
    updatedAt: startedAt,
  }).where(eq(tournaments.id, division.tournamentId));
  const summary = { divisionId, stageId: stage.id, actualParticipants: entrants.length, generatedSize };
  await audit(tx, context, "division.started", "division", divisionId, summary);
  await tx.insert(outboxEvents).values({
    aggregateType: "division",
    aggregateId: divisionId,
    type: "division.started",
    payload: { tournamentId: division.tournamentId, ...summary },
  });
  return { ...summary, status: "live" as const };
}

export function startDivision(divisionId: string, context: ActorContext = {}) {
  return db.transaction((tx) => startDivisionTx(tx, divisionId, context));
}

export async function startTournamentTx(
  tx: LifecycleTransaction,
  tournamentId: string,
  context: ActorContext = {},
) {
  const [tournament] = await tx.select({ id: tournaments.id }).from(tournaments)
    .where(eq(tournaments.id, tournamentId)).for("update").limit(1);
  if (!tournament) throw new LifecycleError("TOURNAMENT_NOT_FOUND", "The event was not found.", 404);
  const eventDivisions = await tx.select().from(divisions).where(eq(divisions.tournamentId, tournamentId));
  if (eventDivisions.length === 0) throw new LifecycleError("DIVISIONS_REQUIRED", "Add at least one game competition before starting.");
  const summaries = [];
  for (const division of eventDivisions) summaries.push(await startDivisionTx(tx, division.id, context));
  return { tournamentId, status: "live" as const, divisions: summaries };
}

export function startTournament(tournamentId: string, context: ActorContext = {}) {
  return db.transaction((tx) => startTournamentTx(tx, tournamentId, context));
}

export async function getDivisionPreviewTx(tx: LifecycleTransaction, divisionId: string) {
  const inspection = await inspectDivisionStartTx(tx, divisionId);
  const { division, stage, entrants, configuration, bestOf } = inspection;
  const validation = await validateDivisionStartTx(tx, divisionId);
  if (!stage) return { division, validation, stage: null, bracket: null, matches: [] };

  const persistedRounds = await tx.select().from(rounds).where(eq(rounds.stageId, stage.id))
    .orderBy(asc(rounds.sequence));
  const persistedMatches = await tx.select().from(matches).where(eq(matches.stageId, stage.id))
    .orderBy(asc(matches.sequence));
  const persistedSides = persistedMatches.length
    ? await tx.select().from(matchSides).where(inArray(matchSides.matchId, persistedMatches.map((match) => match.id)))
    : [];
  const numberedPersistedMatches = [...persistedMatches].sort((left, right) => {
    const leftRound = persistedRounds.find((round) => round.id === left.roundId);
    const rightRound = persistedRounds.find((round) => round.id === right.roundId);
    return compareBracketMatchOrder(
      { roundSequence: leftRound?.sequence ?? 0, lane: leftRound?.bracketLane ?? "main", matchSequence: left.sequence },
      { roundSequence: rightRound?.sequence ?? 0, lane: rightRound?.bracketLane ?? "main", matchSequence: right.sequence },
    );
  });
  const matchNumberById = new Map(numberedPersistedMatches.map((match, index) => [match.id, index + 1]));
  const matchList: Array<{
    id: string;
    code: string;
    matchNumber: number;
    status: string;
    bestOf: number;
    round: string;
    roundSequence: number;
    lane: string;
    startedAt: string | null;
    endedAt: string | null;
    sides: Array<{ participantId: string | null; name: string | null; score: number; outcome: string | null; sourceMatchCode: string | null; sourceOutcome: string | null }>;
  }> = persistedMatches.map((match) => {
    const round = persistedRounds.find((item) => item.id === match.roundId);
    return {
      id: match.id,
      code: match.code,
      matchNumber: matchNumberById.get(match.id) ?? 0,
      status: match.status,
      bestOf: match.bestOf,
      round: round?.label ?? "Round",
      roundSequence: round?.sequence ?? 0,
      lane: round?.bracketLane ?? "main",
      startedAt: match.startedAt?.toISOString() ?? null,
      endedAt: match.endedAt?.toISOString() ?? null,
      sides: persistedSides.filter((side) => side.matchId === match.id)
        .sort((left, right) => left.slot - right.slot)
        .map((side) => ({ participantId: side.participantId, name: side.displayNameSnapshot, score: side.score, outcome: side.outcome, sourceMatchCode: side.sourceMatchCode, sourceOutcome: side.sourceOutcome })),
    };
  });

  let bracket: Bracket | null = null;
  if (stage.format === "single_elimination" || stage.format === "double_elimination") {
    if (persistedMatches.length === 0 && entrants.length >= 2) {
      bracket = stage.format === "single_elimination"
        ? generateSingleElimination(entrants, { bestOf })
        : generateDoubleElimination(entrants, { bestOf, grandFinalReset: configuration.grandFinalReset });
    } else if (persistedMatches.length > 0) {
      bracket = {
        format: stage.format,
        size: Number((stage.configuration as { generatedBracketSize?: number }).generatedBracketSize ?? entrants.length),
        rounds: persistedRounds.map((round) => ({
          sequence: round.sequence,
          label: round.label,
          lane: round.bracketLane as "main" | "upper" | "lower" | "final",
          matches: persistedMatches.filter((match) => match.roundId === round.id).map((match) => {
            const sides = persistedSides.filter((side) => side.matchId === match.id).sort((left, right) => left.slot - right.slot);
            return {
              code: match.code,
              round: round.sequence,
              lane: round.bracketLane as "main" | "upper" | "lower" | "final",
              bestOf: match.bestOf,
              slots: sides.map((side) => {
                if (side.participantId) return { type: "participant" as const, participant: { id: side.participantId, name: side.displayNameSnapshot ?? "Participant", seed: 0 } };
                if (side.sourceMatchCode) return { type: "match" as const, matchCode: side.sourceMatchCode, outcome: side.sourceOutcome === "loser" ? "loser" as const : "winner" as const };
                return { type: "bye" as const };
              }) as [SlotSource, SlotSource],
            };
          }),
        })),
      };
    }
  }
  if (stage.format === "round_robin" && persistedMatches.length === 0 && entrants.length >= 2) {
    const fixtures = generateRoundRobin(entrants, configuration.legs ?? 1);
    matchList.push(...fixtures.map((fixture, index) => ({
      id: `preview-${index + 1}`,
      code: `RR${fixture.round}-M${index + 1}`,
      matchNumber: index + 1,
      status: "preview" as const,
      bestOf,
      round: `Round ${fixture.round}`,
      roundSequence: fixture.round,
      lane: "main",
      startedAt: null,
      endedAt: null,
      sides: [
        { participantId: fixture.home.id, name: fixture.home.name, score: 0, outcome: null, sourceMatchCode: null, sourceOutcome: null },
        { participantId: fixture.away.id, name: fixture.away.name, score: 0, outcome: null, sourceMatchCode: null, sourceOutcome: null },
      ],
    })));
  }
  return {
    division: { id: division.id, name: division.name, status: division.status, competitionType: division.competitionType },
    validation,
    stage: { id: stage.id, name: stage.name, format: stage.format, status: stage.status },
    bracket,
    matches: matchList,
  };
}

async function getMatchContextTx(tx: LifecycleTransaction, matchId: string) {
  const [match] = await tx.select({
    id: matches.id,
    code: matches.code,
    stageId: matches.stageId,
    status: matches.status,
    startedAt: matches.startedAt,
    winnerParticipantId: matches.winnerParticipantId,
    resultVersion: matches.resultVersion,
    format: stages.format,
    divisionId: stages.divisionId,
  }).from(matches).innerJoin(stages, eq(stages.id, matches.stageId)).where(eq(matches.id, matchId)).for("update").limit(1);
  if (!match) throw new LifecycleError("MATCH_NOT_FOUND", "The match was not found.", 404);
  return match;
}

export async function startMatchTx(tx: LifecycleTransaction, matchId: string, context: ActorContext = {}) {
  const match = await getMatchContextTx(tx, matchId);
  assertMatchTransition(match.status as MatchLifecycleStatus, "live");
  const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, matchId));
  if (sides.filter((side) => side.participantId).length !== 2) {
    throw new LifecycleError("MATCH_NOT_READY", "Both match participants must be resolved before the match can start.");
  }
  const now = new Date();
  const startedAt = match.startedAt ?? now;
  await tx.update(matches).set({ status: "live", startedAt, endedAt: null, updatedAt: now }).where(eq(matches.id, matchId));
  await audit(tx, context, "match.started", "match", matchId, { stageId: match.stageId });
  return { matchId, status: "live" as const };
}

export function startMatch(matchId: string, context: ActorContext = {}) {
  return db.transaction((tx) => startMatchTx(tx, matchId, context));
}

export async function stopMatchTx(tx: LifecycleTransaction, matchId: string, context: ActorContext = {}) {
  const match = await getMatchContextTx(tx, matchId);
  assertMatchTransition(match.status as MatchLifecycleStatus, "paused");
  await tx.update(matches).set({ status: "paused", updatedAt: new Date() }).where(eq(matches.id, matchId));
  await audit(tx, context, "match.paused", "match", matchId, { stageId: match.stageId });
  return { matchId, status: "paused" as const };
}

export function stopMatch(matchId: string, context: ActorContext = {}) {
  return db.transaction((tx) => stopMatchTx(tx, matchId, context));
}

export async function adjustMatchScoreTx(
  tx: LifecycleTransaction,
  input: { matchId: string; slot: 1 | 2; delta: 1 | -1 },
  context: ActorContext = {},
): Promise<{ matchId: string; scores: [number, number] }> {
  const match = await getMatchContextTx(tx, input.matchId);
  if (match.status !== "live" && match.status !== "paused") {
    throw new LifecycleError("MATCH_NOT_LIVE", "Scores can only be adjusted while the match is live or paused.", 409);
  }
  const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, input.matchId)).orderBy(asc(matchSides.slot));
  if (sides.length !== 2) throw new LifecycleError("MATCH_NOT_READY", "The match does not have two sides.");
  const target = sides.find((side) => side.slot === input.slot);
  if (!target) throw new LifecycleError("MATCH_NOT_READY", "The requested match side was not found.", 404);
  const nextScore = Math.max(0, target.score + input.delta);
  if (nextScore !== target.score) {
    await tx.update(matchSides).set({ score: nextScore }).where(eq(matchSides.id, target.id));
    await tx.update(matches).set({ updatedAt: new Date() }).where(eq(matches.id, input.matchId));
    await audit(tx, context, "match.score_adjusted", "match", input.matchId, { slot: input.slot, delta: input.delta, score: nextScore });
  }
  const scores = sides.map((side) => (side.slot === input.slot ? nextScore : side.score)) as [number, number];
  return { matchId: input.matchId, scores };
}

export function adjustMatchScore(input: { matchId: string; slot: 1 | 2; delta: 1 | -1 }, context: ActorContext = {}) {
  return db.transaction((tx) => adjustMatchScoreTx(tx, input, context));
}

async function recalculateStandingsTx(tx: LifecycleTransaction, stageId: string) {
  const participants = await tx.select().from(stageParticipants).where(eq(stageParticipants.stageId, stageId));
  if (participants.length === 0) return;
  const stageMatches = await tx.select({
    id: matches.id,
    winnerId: matches.winnerParticipantId,
    status: matches.status,
    roundSequence: rounds.sequence,
    lane: rounds.bracketLane,
    matchSequence: matches.sequence,
  }).from(matches).innerJoin(rounds, eq(rounds.id, matches.roundId))
    .where(eq(matches.stageId, stageId));
  const ids = stageMatches.map((match) => match.id);
  const sides = ids.length ? await tx.select().from(matchSides).where(inArray(matchSides.matchId, ids)) : [];
  const values = participants.map((participant) => ({
    participantId: participant.participantId,
    displayName: participant.displayNameSnapshot,
    seed: participant.seed,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    lastLossOrder: -1,
  }));
  const byParticipant = new Map(values.map((value) => [value.participantId, value]));
  const completed = stageMatches
    .filter((match) => match.status === "final" || match.status === "forfeit")
    .sort((left, right) => left.roundSequence - right.roundSequence || left.matchSequence - right.matchSequence);
  for (const [order, match] of completed.entries()) {
    const currentSides = sides.filter((side) => side.matchId === match.id && side.participantId);
    for (const side of currentSides) {
      const row = byParticipant.get(side.participantId as string);
      const opponent = currentSides.find((item) => item.id !== side.id);
      if (!row) continue;
      row.played += 1;
      row.scoreFor += side.score;
      row.scoreAgainst += opponent?.score ?? 0;
      if (!match.winnerId) {
        row.draws += 1;
        row.points += 1;
      } else if (match.winnerId === side.participantId) {
        row.wins += 1;
        row.points += 3;
      } else {
        row.losses += 1;
        row.lastLossOrder = order;
      }
    }
  }
  values.sort((left, right) =>
    right.points - left.points
    || (right.scoreFor - right.scoreAgainst) - (left.scoreFor - left.scoreAgainst)
    || right.wins - left.wins
    || right.lastLossOrder - left.lastLossOrder
    || left.seed - right.seed);

  await tx.delete(standings).where(eq(standings.stageId, stageId));
  await tx.insert(standings).values(values.map((value, index) => ({
    stageId,
    participantId: value.participantId,
    displayNameSnapshot: value.displayName,
    rank: index + 1,
    played: value.played,
    wins: value.wins,
    draws: value.draws,
    losses: value.losses,
    points: value.points,
    scoreFor: value.scoreFor,
    scoreAgainst: value.scoreAgainst,
    tieBreakSnapshot: { scoreDifference: value.scoreFor - value.scoreAgainst, seed: value.seed },
  })));
}

export async function finishMatchTx(
  tx: LifecycleTransaction,
  input: {
    matchId: string;
    winnerParticipantId: string | null;
    scores: [number, number];
    startNext?: boolean;
  },
  context: ActorContext = {},
) {
  const match = await getMatchContextTx(tx, input.matchId);
  assertMatchTransition(match.status as MatchLifecycleStatus, "final");
  if (input.scores.some((score) => !Number.isInteger(score) || score < 0)) {
    throw new LifecycleError("INVALID_SCORE", "Match scores must be non-negative integers.", 422);
  }
  const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, input.matchId)).orderBy(asc(matchSides.slot));
  const participantIds = sides.flatMap((side) => side.participantId ? [side.participantId] : []);
  if (participantIds.length !== 2) throw new LifecycleError("MATCH_NOT_READY", "Both participants are required to finish a match.");
  if (input.winnerParticipantId && !participantIds.includes(input.winnerParticipantId)) {
    throw new LifecycleError("INVALID_WINNER", "The winner must be a participant in this match.", 422);
  }
  if (!input.winnerParticipantId && match.format !== "round_robin") {
    throw new LifecycleError("WINNER_REQUIRED", "Elimination matches cannot end in a draw.", 422);
  }

  for (const [index, side] of sides.entries()) {
    const isWinner = side.participantId === input.winnerParticipantId;
    await tx.update(matchSides).set({
      score: input.scores[index],
      outcome: input.winnerParticipantId ? (isWinner ? "win" : "loss") : "draw",
    }).where(eq(matchSides.id, side.id));
  }
  const endedAt = new Date();
  await tx.update(matches).set({
    status: "final",
    winnerParticipantId: input.winnerParticipantId,
    resultVersion: 1,
    endedAt,
    updatedAt: endedAt,
  }).where(eq(matches.id, input.matchId));

  const loserId = input.winnerParticipantId
    ? participantIds.find((participantId) => participantId !== input.winnerParticipantId) ?? null
    : null;
  const names = new Map(sides.filter((side) => side.participantId).map((side) => [side.participantId as string, side.displayNameSnapshot ?? ""]));
  await propagateMatchOutcomeTx(tx, match.stageId, match.code, input.winnerParticipantId, loserId, names);
  await refreshStageReadinessTx(tx, match.stageId);
  await recalculateStandingsTx(tx, match.stageId);

  const remaining = await tx.select({ id: matches.id }).from(matches).where(and(
    eq(matches.stageId, match.stageId),
    inArray(matches.status, ["scheduled", "ready", "live", "paused", "reported", "confirmed", "disputed"]),
  ));
  if (remaining.length === 0) {
    await tx.update(stages).set({ status: "completed", updatedAt: new Date() }).where(eq(stages.id, match.stageId));
  }

  let nextMatchId: string | null = null;
  if (input.startNext && remaining.length > 0) {
    const [next] = await tx.select({ id: matches.id }).from(matches)
      .innerJoin(rounds, eq(rounds.id, matches.roundId))
      .where(and(eq(matches.stageId, match.stageId), eq(matches.status, "ready")))
      .orderBy(asc(rounds.sequence), asc(matches.sequence)).limit(1);
    if (next) {
      const startedAt = new Date();
      await tx.update(matches).set({ status: "live", startedAt, endedAt: null, updatedAt: startedAt }).where(eq(matches.id, next.id));
      nextMatchId = next.id;
    }
  }
  await audit(tx, context, "match.finished", "match", input.matchId, {
    stageId: match.stageId,
    winnerParticipantId: input.winnerParticipantId,
    scores: input.scores,
    nextMatchId,
  });
  return { matchId: input.matchId, status: "final" as const, nextMatchId };
}

export function finishMatch(
  input: Parameters<typeof finishMatchTx>[1],
  context: ActorContext = {},
) {
  return db.transaction((tx) => finishMatchTx(tx, input, context));
}

export async function editMatchResultTx(
  tx: LifecycleTransaction,
  input: {
    matchId: string;
    winnerParticipantId: string | null;
    scores: [number, number];
    reason: string;
  },
  context: ActorContext = {},
) {
  const match = await getMatchContextTx(tx, input.matchId);
  if (match.status !== "final") {
    throw new LifecycleError("RESULT_EDIT_LOCKED", "Only a completed match result can be edited.");
  }
  const [division] = await tx.select({ status: divisions.status }).from(divisions).where(eq(divisions.id, match.divisionId)).limit(1);
  if (division?.status === "completed") {
    throw new LifecycleError("RESULT_EDIT_LOCKED", "Completed tournament history cannot be changed.");
  }
  const reason = input.reason.trim();
  if (!reason) throw new LifecycleError("EDIT_REASON_REQUIRED", "A result correction reason is required.", 422);
  if (input.scores.some((score) => !Number.isInteger(score) || score < 0)) {
    throw new LifecycleError("INVALID_SCORE", "Match scores must be non-negative integers.", 422);
  }

  const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, input.matchId)).orderBy(asc(matchSides.slot));
  const participantIds = sides.flatMap((side) => side.participantId ? [side.participantId] : []);
  if (participantIds.length !== 2) throw new LifecycleError("MATCH_NOT_READY", "Both participants are required to edit a result.");
  if (input.winnerParticipantId && !participantIds.includes(input.winnerParticipantId)) {
    throw new LifecycleError("INVALID_WINNER", "The winner must be a participant in this match.", 422);
  }
  if (!input.winnerParticipantId && match.format !== "round_robin") {
    throw new LifecycleError("WINNER_REQUIRED", "Elimination matches cannot end in a draw.", 422);
  }
  if (input.winnerParticipantId) {
    const winnerIndex = sides.findIndex((side) => side.participantId === input.winnerParticipantId);
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    if (input.scores[winnerIndex] <= input.scores[loserIndex]) {
      throw new LifecycleError("INVALID_WINNING_SCORE", "The selected winner must have the higher score.", 422);
    }
  }

  const winnerChanged = match.winnerParticipantId !== input.winnerParticipantId;
  if (winnerChanged) {
    const stageMatches = await tx.select({ id: matches.id, status: matches.status }).from(matches).where(eq(matches.stageId, match.stageId));
    const stageMatchIds = stageMatches.map((stageMatch) => stageMatch.id);
    const dependentSides = stageMatchIds.length
      ? await tx.select({ matchId: matchSides.matchId }).from(matchSides).where(and(
          inArray(matchSides.matchId, stageMatchIds),
          eq(matchSides.sourceMatchCode, match.code),
        ))
      : [];
    const dependentIds = new Set(dependentSides.map((side) => side.matchId));
    const lockedDependent = stageMatches.find((stageMatch) => dependentIds.has(stageMatch.id)
      && stageMatch.status !== "scheduled" && stageMatch.status !== "ready");
    if (lockedDependent) {
      throw new LifecycleError("DOWNSTREAM_MATCH_LOCKED", "The winner cannot be changed because a dependent bracket match has already started or finished.");
    }
  }

  const previousResult = {
    winnerParticipantId: match.winnerParticipantId,
    scores: sides.map((side) => side.score),
    resultVersion: match.resultVersion,
  };
  for (const [index, side] of sides.entries()) {
    const isWinner = side.participantId === input.winnerParticipantId;
    await tx.update(matchSides).set({
      score: input.scores[index],
      outcome: input.winnerParticipantId ? (isWinner ? "win" : "loss") : "draw",
    }).where(eq(matchSides.id, side.id));
  }
  const updatedAt = new Date();
  await tx.update(matches).set({
    winnerParticipantId: input.winnerParticipantId,
    resultVersion: match.resultVersion + 1,
    updatedAt,
  }).where(eq(matches.id, input.matchId));

  if (winnerChanged) {
    const loserId = input.winnerParticipantId
      ? participantIds.find((participantId) => participantId !== input.winnerParticipantId) ?? null
      : null;
    const names = new Map(sides.filter((side) => side.participantId).map((side) => [side.participantId as string, side.displayNameSnapshot ?? ""]));
    await propagateMatchOutcomeTx(tx, match.stageId, match.code, input.winnerParticipantId, loserId, names);
    await refreshStageReadinessTx(tx, match.stageId);
  }
  await recalculateStandingsTx(tx, match.stageId);
  await audit(tx, context, "match.result_edited", "match", input.matchId, {
    stageId: match.stageId,
    previousResult,
    winnerParticipantId: input.winnerParticipantId,
    scores: input.scores,
    resultVersion: match.resultVersion + 1,
    reason,
  });
  return { matchId: input.matchId, status: "final" as const, resultVersion: match.resultVersion + 1 };
}

export function editMatchResult(input: Parameters<typeof editMatchResultTx>[1], context: ActorContext = {}) {
  return db.transaction((tx) => editMatchResultTx(tx, input, context));
}

export async function editMatchParticipantsTx(
  tx: LifecycleTransaction,
  input: { matchId: string; participantIds: [string, string]; reason: string },
  context: ActorContext = {},
) {
  const match = await getMatchContextTx(tx, input.matchId);
  if (match.status !== "scheduled" && match.status !== "ready") {
    throw new LifecycleError("BRACKET_EDIT_LOCKED", "Only a match that has not started can be edited.");
  }
  if (!input.reason.trim()) throw new LifecycleError("EDIT_REASON_REQUIRED", "A bracket edit reason is required.", 422);
  if (input.participantIds[0] === input.participantIds[1]) {
    throw new LifecycleError("DUPLICATE_PARTICIPANT", "A participant cannot occupy both match slots.", 422);
  }
  const participants = await tx.select().from(stageParticipants).where(and(
    eq(stageParticipants.stageId, match.stageId),
    inArray(stageParticipants.participantId, input.participantIds),
  ));
  if (participants.length !== 2) throw new LifecycleError("INVALID_STAGE_PARTICIPANT", "Both players must belong to this stage.", 422);
  const sides = await tx.select().from(matchSides).where(eq(matchSides.matchId, input.matchId)).orderBy(asc(matchSides.slot));
  for (const [index, side] of sides.entries()) {
    const participant = participants.find((item) => item.participantId === input.participantIds[index]);
    await tx.update(matchSides).set({
      participantId: participant?.participantId,
      displayNameSnapshot: participant?.displayNameSnapshot,
      sourceMatchCode: null,
      sourceOutcome: null,
    }).where(eq(matchSides.id, side.id));
  }
  await tx.update(matches).set({ status: "ready", updatedAt: new Date() }).where(eq(matches.id, input.matchId));
  await audit(tx, context, "match.participants_edited", "match", input.matchId, {
    participantIds: input.participantIds,
    reason: input.reason.trim(),
  });
  return { matchId: input.matchId, participantIds: input.participantIds };
}

export function editMatchParticipants(input: Parameters<typeof editMatchParticipantsTx>[1], context: ActorContext = {}) {
  return db.transaction((tx) => editMatchParticipantsTx(tx, input, context));
}

export async function changeParticipantSponsorTx(
  tx: LifecycleTransaction,
  input: {
    subjectType: "gamer" | "team";
    subjectId: string;
    sponsorId: string;
    startsAt?: Date;
    public?: boolean;
  },
  context: ActorContext = {},
) {
  const startsAt = input.startsAt ?? new Date();
  await tx.update(sponsorships).set({ status: "ended", endsAt: startsAt, updatedAt: new Date() }).where(and(
    eq(sponsorships.subjectType, input.subjectType),
    eq(sponsorships.subjectId, input.subjectId),
    eq(sponsorships.status, "active"),
  ));
  const [created] = await tx.insert(sponsorships).values({
    sponsorId: input.sponsorId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    status: "active",
    public: input.public ?? true,
    startsAt,
  }).returning();
  await audit(tx, context, "sponsorship.changed", input.subjectType, input.subjectId, {
    sponsorshipId: created.id,
    sponsorId: input.sponsorId,
    startsAt: startsAt.toISOString(),
  });
  return created;
}

export async function completeDivisionTx(
  tx: LifecycleTransaction,
  divisionId: string,
  context: ActorContext = {},
) {
  const [division] = await tx.select().from(divisions).where(eq(divisions.id, divisionId)).for("update").limit(1);
  if (!division) throw new LifecycleError("DIVISION_NOT_FOUND", "The game tournament was not found.", 404);
  if (division.status !== "live") throw new LifecycleError("DIVISION_NOT_LIVE", "Only a live game tournament can be ended.");
  const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, division.tournamentId)).limit(1);
  if (!tournament) throw new LifecycleError("TOURNAMENT_NOT_FOUND", "The parent event was not found.", 404);
  const divisionStages = await tx.select().from(stages).where(eq(stages.divisionId, divisionId));
  const startedStages = divisionStages.filter((stage) => stage.lockedAt)
    .sort((left, right) => right.sequence - left.sequence);
  if (startedStages.length === 0) throw new LifecycleError("STAGE_NOT_STARTED", "No stage has been started for this game tournament.");
  if (startedStages.some((stage) => stage.status !== "completed")) {
    throw new LifecycleError("STAGES_INCOMPLETE", "Every started stage must be completed before ending this game tournament.");
  }
  const stageIds = startedStages.map((stage) => stage.id);
  const divisionMatches = await tx.select({ id: matches.id, code: matches.code, status: matches.status })
    .from(matches).where(inArray(matches.stageId, stageIds));
  if (divisionMatches.length === 0) throw new LifecycleError("MATCHES_REQUIRED", "The game tournament has no persisted matches to complete.");
  const unfinishedMatches = divisionMatches.filter((match) => !["final", "forfeit", "cancelled"].includes(match.status));
  if (unfinishedMatches.length > 0) {
    throw new LifecycleError(
      "MATCHES_INCOMPLETE",
      `${unfinishedMatches.length} ${unfinishedMatches.length === 1 ? "match is" : "matches are"} unfinished: ${unfinishedMatches.slice(0, 5).map((match) => match.code).join(", ")}.`,
    );
  }

  const completedAt = new Date();
  const finalStage = startedStages[0];
  const participants = await tx.select().from(stageParticipants).where(eq(stageParticipants.stageId, finalStage.id));
  const finalStandings = await tx.select().from(standings).where(eq(standings.stageId, finalStage.id));
  const divisionRegistrations = await tx.select().from(registrations).where(eq(registrations.divisionId, division.id));
  let captured = 0;
  for (const participant of participants) {
    const registration = divisionRegistrations.find((item) => item.participantId === participant.participantId);
    const standing = finalStandings.find((item) => item.participantId === participant.participantId);
    const profileSnapshot = participant.participantType === "gamer"
      ? (await tx.select().from(gamerProfiles).where(eq(gamerProfiles.id, participant.participantId)).limit(1))[0] ?? {}
      : (await tx.select().from(teams).where(eq(teams.id, participant.participantId)).limit(1))[0] ?? {};
    const sponsorRows = await tx.select({
      sponsorshipId: sponsorships.id,
      status: sponsorships.status,
      startsAt: sponsorships.startsAt,
      endsAt: sponsorships.endsAt,
      public: sponsorships.public,
      sponsorId: sponsors.id,
      sponsorName: sponsors.name,
      sponsorSlug: sponsors.slug,
      sponsorCategory: sponsors.category,
      sponsorWebsiteUrl: sponsors.websiteUrl,
      sponsorLogoUrl: sponsors.logoUrl,
    }).from(sponsorships).innerJoin(sponsors, eq(sponsors.id, sponsorships.sponsorId)).where(and(
      eq(sponsorships.subjectType, participant.participantType),
      eq(sponsorships.subjectId, participant.participantId),
    ));
    const competitionStart = division.actualStartedAt ?? tournament.actualStartedAt ?? tournament.startsAt ?? tournament.createdAt;
    const sponsorSnapshot = sponsorRows.filter((row) =>
      (!row.startsAt || row.startsAt <= completedAt) && (!row.endsAt || row.endsAt >= competitionStart));
    await tx.insert(tournamentParticipantSnapshots).values({
      tournamentId: tournament.id,
      divisionId: division.id,
      participantId: participant.participantId,
      participantType: participant.participantType,
      displayName: participant.displayNameSnapshot,
      finalRank: standing?.rank,
      profileSnapshot,
      rosterSnapshot: registration?.rosterSnapshot ?? [],
      sponsorSnapshot,
      capturedAt: completedAt,
    }).onConflictDoNothing();
    captured += 1;
  }

  await tx.update(divisions).set({ status: "completed", completedAt, updatedAt: completedAt })
    .where(eq(divisions.id, divisionId));
  const eventDivisions = await tx.select({ id: divisions.id, status: divisions.status }).from(divisions)
    .where(eq(divisions.tournamentId, tournament.id));
  const eventCompleted = eventDivisions.every((item) =>
    item.id === divisionId || item.status === "completed" || item.status === "cancelled");
  if (eventCompleted) {
    await tx.update(tournaments).set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(eq(tournaments.id, tournament.id));
  }
  await audit(tx, context, "division.completed", "division", divisionId, { capturedParticipants: captured, matches: divisionMatches.length });
  await tx.insert(outboxEvents).values({
    aggregateType: "division",
    aggregateId: divisionId,
    type: "division.completed",
    payload: { tournamentId: tournament.id, capturedParticipants: captured, matches: divisionMatches.length, completedAt: completedAt.toISOString() },
  });
  return { divisionId, tournamentId: tournament.id, status: "completed" as const, capturedParticipants: captured, completedAt, eventCompleted };
}

export function completeDivision(divisionId: string, context: ActorContext = {}) {
  return db.transaction((tx) => completeDivisionTx(tx, divisionId, context));
}

export async function completeTournamentTx(
  tx: LifecycleTransaction,
  tournamentId: string,
  context: ActorContext = {},
) {
  const [tournament] = await tx.select({ id: tournaments.id }).from(tournaments)
    .where(eq(tournaments.id, tournamentId)).for("update").limit(1);
  if (!tournament) throw new LifecycleError("TOURNAMENT_NOT_FOUND", "The event was not found.", 404);
  const eventDivisions = await tx.select().from(divisions).where(eq(divisions.tournamentId, tournamentId));
  const incomplete = eventDivisions.filter((division) => division.status !== "completed" && division.status !== "cancelled");
  if (incomplete.some((division) => division.status !== "live")) {
    throw new LifecycleError("DIVISIONS_INCOMPLETE", "Every game tournament must be started and completed before ending the whole event.");
  }
  const results = [];
  for (const division of incomplete) results.push(await completeDivisionTx(tx, division.id, context));
  return {
    tournamentId,
    status: "completed" as const,
    capturedParticipants: results.reduce((total, result) => total + result.capturedParticipants, 0),
    completedAt: results.at(-1)?.completedAt ?? new Date(),
  };
}

export function completeTournament(tournamentId: string, context: ActorContext = {}) {
  return db.transaction((tx) => completeTournamentTx(tx, tournamentId, context));
}

const terminalDivisionStatuses = new Set(["live", "completed", "cancelled", "archived"]);

export async function setTournamentRegistrationStateTx(
  tx: LifecycleTransaction,
  tournamentId: string,
  action: TournamentRegistrationAction,
  context: ActorContext = {},
) {
  const [tournament] = await tx.select({ id: tournaments.id, status: tournaments.status }).from(tournaments)
    .where(eq(tournaments.id, tournamentId)).for("update").limit(1);
  if (!tournament) throw new LifecycleError("TOURNAMENT_NOT_FOUND", "The event was not found.", 404);
  assertTournamentTransition(tournament.status, action);
  const targetStatus = tournamentActionTargetStatus[action];
  const changedAt = new Date();
  await tx.update(tournaments).set({ status: targetStatus, updatedAt: changedAt }).where(eq(tournaments.id, tournamentId));

  const eventDivisions = await tx.select({ id: divisions.id, status: divisions.status }).from(divisions)
    .where(eq(divisions.tournamentId, tournamentId));
  const syncedDivisionIds = eventDivisions.filter((division) => !terminalDivisionStatuses.has(division.status)).map((division) => division.id);
  if (syncedDivisionIds.length > 0) {
    await tx.update(divisions).set({ status: targetStatus, updatedAt: changedAt }).where(inArray(divisions.id, syncedDivisionIds));
  }

  const eventType = action === "publish" ? "tournament.published" : action === "open_registration" ? "tournament.registration_opened" : "tournament.registration_closed";
  await audit(tx, context, eventType, "tournament", tournamentId, { from: tournament.status, to: targetStatus });
  await tx.insert(outboxEvents).values({
    aggregateType: "tournament",
    aggregateId: tournamentId,
    type: eventType,
    payload: { tournamentId, status: targetStatus, changedAt: changedAt.toISOString() },
  });
  return { tournamentId, status: targetStatus, syncedDivisions: syncedDivisionIds.length };
}

export function setTournamentRegistrationState(tournamentId: string, action: TournamentRegistrationAction, context: ActorContext = {}) {
  return db.transaction((tx) => setTournamentRegistrationStateTx(tx, tournamentId, action, context));
}

export async function reviewRegistrationTx(
  tx: LifecycleTransaction,
  input: { divisionId: string; registrationId: string; action: "approve" | "reject" },
  context: ActorContext = {},
) {
  const [registration] = await tx.select({
    id: registrations.id,
    divisionId: registrations.divisionId,
    status: registrations.status,
    checkedInAt: registrations.checkedInAt,
  }).from(registrations)
    .where(and(eq(registrations.id, input.registrationId), eq(registrations.divisionId, input.divisionId)))
    .for("update").limit(1);
  if (!registration) throw new LifecycleError("REGISTRATION_NOT_FOUND", "The registration was not found.", 404);

  const [division] = await tx.select({ status: divisions.status }).from(divisions)
    .where(eq(divisions.id, registration.divisionId)).limit(1);
  if (!division || terminalDivisionStatuses.has(division.status)) {
    throw new LifecycleError("DIVISION_STARTED", "Registrations cannot be reviewed after the game competition has started.");
  }
  if (registration.status === "withdrawn") {
    throw new LifecycleError("REGISTRATION_WITHDRAWN", "A withdrawn registration cannot be reviewed.");
  }

  const reviewedAt = new Date();
  const changes = input.action === "approve"
    ? { status: "confirmed" as const, eligible: true, checkedInAt: registration.checkedInAt ?? reviewedAt, updatedAt: reviewedAt }
    : { status: "rejected" as const, eligible: false, updatedAt: reviewedAt };
  const [updated] = await tx.update(registrations).set(changes)
    .where(eq(registrations.id, registration.id))
    .returning({ id: registrations.id, status: registrations.status, eligible: registrations.eligible, checkedInAt: registrations.checkedInAt });
  await audit(tx, context, `registration.${input.action === "approve" ? "approved" : "rejected"}`, "registration", registration.id, { divisionId: registration.divisionId });
  return updated;
}

export function reviewRegistration(input: { divisionId: string; registrationId: string; action: "approve" | "reject" }, context: ActorContext = {}) {
  return db.transaction((tx) => reviewRegistrationTx(tx, input, context));
}

export async function withdrawRegistrationTx(
  tx: LifecycleTransaction,
  input: { registrationId: string; gamerProfileId: string },
  context: ActorContext = {},
) {
  const [registration] = await tx.select({
    id: registrations.id,
    divisionId: registrations.divisionId,
    participantId: registrations.participantId,
    participantType: registrations.participantType,
    status: registrations.status,
  }).from(registrations).where(eq(registrations.id, input.registrationId)).for("update").limit(1);
  if (!registration || registration.participantType !== "gamer" || registration.participantId !== input.gamerProfileId) {
    throw new LifecycleError("REGISTRATION_NOT_FOUND", "The registration was not found.", 404);
  }
  if (registration.status === "withdrawn") {
    return { id: registration.id, status: "withdrawn" as const };
  }
  if (registration.status === "rejected") {
    throw new LifecycleError("REGISTRATION_REJECTED", "A rejected registration cannot be withdrawn.");
  }

  const [division] = await tx.select({ status: divisions.status }).from(divisions)
    .where(eq(divisions.id, registration.divisionId)).limit(1);
  if (!division || terminalDivisionStatuses.has(division.status)) {
    throw new LifecycleError("DIVISION_STARTED", "You can no longer withdraw after the game competition has started.");
  }
  const divisionStages = await tx.select({ id: stages.id }).from(stages).where(eq(stages.divisionId, registration.divisionId));
  if (divisionStages.length > 0) {
    const [seeded] = await tx.select({ id: stageParticipants.id }).from(stageParticipants).where(and(
      inArray(stageParticipants.stageId, divisionStages.map((stage) => stage.id)),
      eq(stageParticipants.participantId, registration.participantId),
    )).limit(1);
    if (seeded) throw new LifecycleError("DIVISION_STARTED", "You can no longer withdraw after being seeded into the bracket.");
  }

  const withdrawnAt = new Date();
  const [updated] = await tx.update(registrations)
    .set({ status: "withdrawn", eligible: false, updatedAt: withdrawnAt })
    .where(eq(registrations.id, registration.id))
    .returning({ id: registrations.id, status: registrations.status });
  await audit(tx, context, "registration.withdrawn", "registration", registration.id, { divisionId: registration.divisionId });
  return updated;
}

export function withdrawRegistration(input: { registrationId: string; gamerProfileId: string }, context: ActorContext = {}) {
  return db.transaction((tx) => withdrawRegistrationTx(tx, input, context));
}
