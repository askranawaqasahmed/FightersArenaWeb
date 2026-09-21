import { TournamentBuilder } from "@/components/tournament-builder";
import { adminEvents } from "@/lib/admin-events";
import { getAdminEventFromDatabase } from "@/lib/admin-tournament-data";
import { createGameCompetition, createLeagueTeam, createStage, defaultTournamentDraft, type TournamentDraft } from "@/lib/tournament-draft";

export const metadata = { title: "Edit Event" };

export default async function EditTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const databaseEvent = await getAdminEventFromDatabase(slug);
  const event = databaseEvent?.event ?? adminEvents.find((item) => item.slug === slug);
  const initialDraft: TournamentDraft = event ? {
    slug,
    name: event.name,
    description: event.description,
    imageUrl: "",
    imageAlt: "",
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    hasBracket: event.hasBracket ?? true,
    youtubeUrl: event.youtubeUrl ?? "",
    attachments: [],
    competitions: event.competitions.map((competition, competitionIndex) => {
      const competitionId = `competition-${competitionIndex + 1}`;
      const teamNames = [...new Set(competition.participants.map((participant) => participant.team).filter((team): team is string => Boolean(team)))];
      const leagueTeamCount = competition.teamCount ?? Math.max(2, teamNames.length);
      const leagueTeams = Array.from({ length: leagueTeamCount }, (_, teamIndex) => {
        const teamName = teamNames[teamIndex];
        if (!teamName) return createLeagueTeam(teamIndex, competitionId);
        const teamPlayers = competition.participants.filter((participant) => participant.team === teamName);
        return { id: `${competitionId}-team-${teamIndex + 1}`, name: teamName, leaderId: teamPlayers.find((participant) => participant.isLeader)?.id ?? "", playerIds: teamPlayers.map((participant) => participant.id) };
      });
      return createGameCompetition(competitionId, {
        name: competition.name,
        gameSlug: competition.gameSlug,
        competitionType: competition.type,
        maxEntries: competition.capacity,
        leagueTeamCount,
        playersPerTeam: competition.playersPerTeam ?? 5,
        leagueTeams,
        stages: competition.stages.map((format, stageIndex) => createStage(`${competitionId}-stage-${stageIndex + 1}`, format)),
      });
    }),
  } : { ...defaultTournamentDraft, slug, name: slug.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ") };

  return <TournamentBuilder initialDraft={initialDraft} originalSlug={slug} lifecycleCompetitions={databaseEvent?.lifecycleCompetitions} />;
}
