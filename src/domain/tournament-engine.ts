export type Participant = {
  id: string;
  name: string;
  seed: number;
};

export type SlotSource =
  | { type: "participant"; participant: Participant }
  | { type: "match"; matchCode: string; outcome: "winner" | "loser" }
  | { type: "bye" };

export type GeneratedMatch = {
  code: string;
  round: number;
  lane: "main" | "upper" | "lower" | "final";
  bestOf: number;
  slots: [SlotSource, SlotSource];
};

export type GeneratedRound = {
  sequence: number;
  label: string;
  lane: GeneratedMatch["lane"];
  matches: GeneratedMatch[];
};

export type Bracket = {
  format: "single_elimination" | "double_elimination";
  size: number;
  rounds: GeneratedRound[];
};

export type RoundRobinFixture = {
  round: number;
  home: Participant;
  away: Participant;
};

const nextPowerOfTwo = (value: number) => {
  if (value < 2) throw new Error("At least two participants are required.");
  return 2 ** Math.ceil(Math.log2(value));
};

export function createSeedOrder(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("Bracket size must be a power of two.");
  }

  let order = [1, 2];
  while (order.length < size) {
    const mirror = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, mirror - seed]);
  }
  return order;
}

function participantSlots(participants: Participant[], size: number): SlotSource[] {
  const bySeed = new Map(participants.map((participant) => [participant.seed, participant]));
  return createSeedOrder(size).map((seed) => {
    const participant = bySeed.get(seed);
    return participant ? { type: "participant", participant } : { type: "bye" };
  });
}

function roundLabel(round: number, totalRounds: number) {
  const remaining = 2 ** (totalRounds - round + 1);
  if (remaining === 2) return "Grand Final";
  if (remaining === 4) return "Semifinals";
  if (remaining === 8) return "Quarterfinals";
  return `Round of ${remaining}`;
}

export function generateSingleElimination(
  participants: Participant[],
  options: { bestOf?: number } = {},
): Bracket {
  const size = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(size);
  const slots = participantSlots(participants, size);
  const rounds: GeneratedRound[] = [];

  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = size / 2 ** round;
    const matches: GeneratedMatch[] = [];
    for (let matchIndex = 1; matchIndex <= matchCount; matchIndex += 1) {
      const code = `R${round}-M${matchIndex}`;
      const matchSlots: [SlotSource, SlotSource] = round === 1
        ? [slots[(matchIndex - 1) * 2], slots[(matchIndex - 1) * 2 + 1]]
        : [
            { type: "match", matchCode: `R${round - 1}-M${matchIndex * 2 - 1}`, outcome: "winner" },
            { type: "match", matchCode: `R${round - 1}-M${matchIndex * 2}`, outcome: "winner" },
          ];
      matches.push({ code, round, lane: "main", bestOf: options.bestOf ?? 3, slots: matchSlots });
    }
    rounds.push({ sequence: round, label: roundLabel(round, totalRounds), lane: "main", matches });
  }

  return { format: "single_elimination", size, rounds };
}

export function generateDoubleElimination(
  participants: Participant[],
  options: { bestOf?: number; grandFinalReset?: boolean } = {},
): Bracket {
  const size = nextPowerOfTwo(participants.length);
  const upperRoundCount = Math.log2(size);
  const upper = generateSingleElimination(participants, options).rounds.map((round) => ({
    ...round,
    lane: "upper" as const,
    label: `Upper ${round.label}`,
    matches: round.matches.map((match) => ({
      ...match,
      lane: "upper" as const,
      code: match.code.replace("R", "U"),
      slots: match.slots.map((slot) => slot.type === "match"
        ? { ...slot, matchCode: slot.matchCode.replace("R", "U") }
        : slot) as [SlotSource, SlotSource],
    })),
  }));

  const lower: GeneratedRound[] = [];
  let lowerRoundNumber = 0;

  if (size === 2) {
    lower.push({
      sequence: 1,
      label: "Lower Final",
      lane: "lower",
      matches: [{
        code: "L1-M1",
        round: 1,
        lane: "lower",
        bestOf: options.bestOf ?? 3,
        slots: [
          { type: "match", matchCode: "U1-M1", outcome: "loser" },
          { type: "bye" },
        ],
      }],
    });
    lowerRoundNumber = 1;
  } else {
    lowerRoundNumber = 1;
    const openingMatches: GeneratedMatch[] = [];
    for (let matchIndex = 1; matchIndex <= size / 4; matchIndex += 1) {
      openingMatches.push({
        code: `L1-M${matchIndex}`,
        round: 1,
        lane: "lower",
        bestOf: options.bestOf ?? 3,
        slots: [
          { type: "match", matchCode: `U1-M${matchIndex * 2 - 1}`, outcome: "loser" },
          { type: "match", matchCode: `U1-M${matchIndex * 2}`, outcome: "loser" },
        ],
      });
    }
    lower.push({ sequence: 1, label: "Lower Round 1", lane: "lower", matches: openingMatches });

    for (let upperRound = 2; upperRound <= upperRoundCount; upperRound += 1) {
      lowerRoundNumber += 1;
      const matchCount = size / 2 ** upperRound;
      const incomingMatches: GeneratedMatch[] = [];
      for (let matchIndex = 1; matchIndex <= matchCount; matchIndex += 1) {
        incomingMatches.push({
          code: `L${lowerRoundNumber}-M${matchIndex}`,
          round: lowerRoundNumber,
          lane: "lower",
          bestOf: options.bestOf ?? 3,
          slots: [
            { type: "match", matchCode: `L${lowerRoundNumber - 1}-M${matchIndex}`, outcome: "winner" },
            { type: "match", matchCode: `U${upperRound}-M${matchIndex}`, outcome: "loser" },
          ],
        });
      }
      lower.push({ sequence: lowerRoundNumber, label: `Lower Round ${lowerRoundNumber}`, lane: "lower", matches: incomingMatches });

      if (upperRound < upperRoundCount) {
        lowerRoundNumber += 1;
        const consolidationMatches: GeneratedMatch[] = [];
        for (let matchIndex = 1; matchIndex <= matchCount / 2; matchIndex += 1) {
          consolidationMatches.push({
            code: `L${lowerRoundNumber}-M${matchIndex}`,
            round: lowerRoundNumber,
            lane: "lower",
            bestOf: options.bestOf ?? 3,
            slots: [
              { type: "match", matchCode: `L${lowerRoundNumber - 1}-M${matchIndex * 2 - 1}`, outcome: "winner" },
              { type: "match", matchCode: `L${lowerRoundNumber - 1}-M${matchIndex * 2}`, outcome: "winner" },
            ],
          });
        }
        lower.push({ sequence: lowerRoundNumber, label: `Lower Round ${lowerRoundNumber}`, lane: "lower", matches: consolidationMatches });
      }
    }
  }

  const finalMatches: GeneratedMatch[] = [{
    code: "GF1",
    round: 1,
    lane: "final",
    bestOf: options.bestOf ?? 3,
    slots: [
      { type: "match", matchCode: `U${upperRoundCount}-M1`, outcome: "winner" },
      { type: "match", matchCode: `L${lowerRoundNumber}-M1`, outcome: "winner" },
    ],
  }];
  if (options.grandFinalReset) {
    finalMatches.push({
      code: "GF2",
      round: 2,
      lane: "final",
      bestOf: options.bestOf ?? 3,
      slots: [
        { type: "match", matchCode: "GF1", outcome: "winner" },
        { type: "match", matchCode: "GF1", outcome: "loser" },
      ],
    });
  }

  return {
    format: "double_elimination",
    size,
    rounds: [...upper, ...lower, { sequence: 1, label: "Grand Final", lane: "final", matches: finalMatches }],
  };
}

export function generateRoundRobin(participants: Participant[], legs = 1): RoundRobinFixture[] {
  if (participants.length < 2) throw new Error("At least two participants are required.");
  if (legs < 1 || legs > 2) throw new Error("Round robin legs must be one or two.");

  const rotating: Array<Participant | null> = [...participants];
  if (rotating.length % 2 !== 0) rotating.push(null);
  const fixtures: RoundRobinFixture[] = [];
  const roundsPerLeg = rotating.length - 1;

  for (let leg = 0; leg < legs; leg += 1) {
    const current = [...rotating];
    for (let round = 0; round < roundsPerLeg; round += 1) {
      for (let index = 0; index < current.length / 2; index += 1) {
        const left = current[index];
        const right = current[current.length - 1 - index];
        if (left && right) {
          const reverse = (round + leg) % 2 === 1;
          fixtures.push({
            round: leg * roundsPerLeg + round + 1,
            home: reverse ? right : left,
            away: reverse ? left : right,
          });
        }
      }
      current.splice(1, 0, current.pop() ?? null);
    }
  }

  return fixtures;
}

export function validateBracket(bracket: Bracket): string[] {
  const errors: string[] = [];
  const codes = new Set<string>();
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      if (codes.has(match.code)) errors.push(`Duplicate match code: ${match.code}`);
      codes.add(match.code);
      if (match.bestOf < 1 || match.bestOf % 2 === 0) errors.push(`${match.code} must use a positive odd best-of value.`);
    }
  }
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      for (const slot of match.slots) {
        if (slot.type === "match" && !codes.has(slot.matchCode)) {
          errors.push(`${match.code} references missing source ${slot.matchCode}.`);
        }
      }
    }
  }
  return errors;
}
