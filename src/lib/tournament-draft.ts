export type StageFormat = "groups" | "single-elimination" | "double-elimination";
export type GameSlug = string;
export type CompetitionType = "tournament" | "league";

export type TournamentStageDraft = {
  id: string;
  format: StageFormat;
  groups: number;
  advancePerGroup: number;
  bestOf: 3 | 5 | 7;
  grandFinalReset: boolean;
};

export type LeagueTeamDraft = {
  id: string;
  name: string;
  leaderId: string;
  playerIds: string[];
};

export type EventAttachmentDraft = {
  key: string;
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type GameCompetitionDraft = {
  id: string;
  name: string;
  gameSlug: GameSlug;
  competitionType: CompetitionType;
  maxEntries: number;
  registrationRestricted: boolean;
  registrationLimit: number;
  leagueTeamCount: number;
  playersPerTeam: number;
  leagueTeams: LeagueTeamDraft[];
  stages: TournamentStageDraft[];
};

export type TournamentDraft = {
  slug?: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  startsAt: string;
  endsAt: string;
  location: string;
  attachments: EventAttachmentDraft[];
  competitions: GameCompetitionDraft[];
};

export function createStage(id: string, format: StageFormat = "groups"): TournamentStageDraft {
  return {
    id,
    format,
    groups: 4,
    advancePerGroup: 2,
    bestOf: 3,
    grandFinalReset: true,
  };
}

export function stageParticipantCount(
  stages: TournamentStageDraft[],
  stageIndex: number,
  competitionParticipantCount: number,
) {
  let participantCount = Math.max(0, Math.floor(competitionParticipantCount));
  for (const stage of stages.slice(0, stageIndex)) {
    if (stage.format === "groups") {
      participantCount = Math.min(participantCount, Math.max(0, Math.floor(stage.groups * stage.advancePerGroup)));
    }
  }
  return participantCount;
}

export function generatedBracketSize(participantCount: number) {
  const safeParticipantCount = Math.max(2, Math.floor(participantCount));
  return 2 ** Math.ceil(Math.log2(safeParticipantCount));
}

export function createLeagueTeam(index: number, competitionId = "competition-1"): LeagueTeamDraft {
  return {
    id: `${competitionId}-team-${index + 1}`,
    name: `Team ${index + 1}`,
    leaderId: "",
    playerIds: [],
  };
}

export function createGameCompetition(
  id: string,
  options: Partial<Omit<GameCompetitionDraft, "id">> = {},
): GameCompetitionDraft {
  const leagueTeamCount = Math.max(2, Number(options.leagueTeamCount ?? 4));
  return {
    id,
    name: options.name ?? "Dota 2 Open",
    gameSlug: options.gameSlug ?? "dota-2",
    competitionType: options.competitionType ?? "tournament",
    maxEntries: options.maxEntries ?? 32,
    registrationRestricted: options.registrationRestricted ?? false,
    registrationLimit: Math.max(2, Number(options.registrationLimit ?? options.maxEntries ?? 32)),
    leagueTeamCount,
    playersPerTeam: options.playersPerTeam ?? 5,
    leagueTeams: options.leagueTeams ?? Array.from({ length: leagueTeamCount }, (_, index) => createLeagueTeam(index, id)),
    stages: options.stages?.length ? options.stages : [createStage(`${id}-stage-1`)],
  };
}

export const defaultTournamentDraft: TournamentDraft = {
  name: "National Esports Championship 2027",
  description: "Pakistan's national multi-game championship event.",
  imageUrl: "",
  imageAlt: "",
  startsAt: "2027-08-18",
  endsAt: "2027-08-24",
  location: "Karachi Expo Centre",
  attachments: [],
  competitions: [createGameCompetition("competition-1")],
};

type LegacyDraft = {
  gameSlug?: GameSlug;
  competitionType?: CompetitionType;
  maxEntries?: number;
  registrationRestricted?: boolean;
  registrationLimit?: number;
  leagueTeamCount?: number;
  playersPerTeam?: number;
  leagueTeams?: LeagueTeamDraft[];
  stages?: TournamentStageDraft[];
};

export function normalizeGameCompetition(
  competition: Partial<GameCompetitionDraft>,
  index: number,
): GameCompetitionDraft {
  const id = competition.id ?? `competition-${index + 1}`;
  const leagueTeamCount = Math.max(2, Number(competition.leagueTeamCount ?? 4));
  const savedTeams = Array.isArray(competition.leagueTeams) ? competition.leagueTeams : [];
  return createGameCompetition(id, {
    ...competition,
    leagueTeamCount,
    leagueTeams: Array.from({ length: leagueTeamCount }, (_, teamIndex) => savedTeams[teamIndex] ?? createLeagueTeam(teamIndex, id)),
    stages: competition.stages?.length ? competition.stages : [createStage(`${id}-stage-1`)],
  });
}

export function normalizeTournamentDraft(draft: Partial<TournamentDraft> & LegacyDraft): TournamentDraft {
  const competitions = draft.competitions?.length
    ? draft.competitions.map(normalizeGameCompetition)
    : [normalizeGameCompetition({
        name: draft.name ? `${draft.name} competition` : "Game competition",
        gameSlug: draft.gameSlug,
        competitionType: draft.competitionType,
        maxEntries: draft.maxEntries,
        registrationRestricted: draft.registrationRestricted,
        registrationLimit: draft.registrationLimit,
        leagueTeamCount: draft.leagueTeamCount,
        playersPerTeam: draft.playersPerTeam,
        leagueTeams: draft.leagueTeams,
        stages: draft.stages,
      }, 0)];

  return {
    slug: draft.slug,
    name: draft.name ?? defaultTournamentDraft.name,
    description: draft.description ?? defaultTournamentDraft.description,
    imageUrl: draft.imageUrl ?? "",
    imageAlt: draft.imageAlt ?? "",
    startsAt: draft.startsAt ?? defaultTournamentDraft.startsAt,
    endsAt: draft.endsAt ?? defaultTournamentDraft.endsAt,
    location: draft.location ?? defaultTournamentDraft.location,
    attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
    competitions,
  };
}

export const tournamentDraftStorageKey = "fighters-arena:tournament-drafts";
