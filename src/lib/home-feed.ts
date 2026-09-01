import { getPublishedSlides, type PublicSlide } from "@/lib/content-slides";
import { getPublicTournaments, type PublicTournamentSummary } from "@/lib/public-tournament-data";

export type HomeFeed = {
  slides: PublicSlide[];
  featured: PublicTournamentSummary[];
  registrationOpen: PublicTournamentSummary[];
  upcoming: PublicTournamentSummary[];
  liveNow: PublicTournamentSummary[];
  recentResults: PublicTournamentSummary[];
};

export async function getHomeFeed(): Promise<HomeFeed> {
  const [slides, tournamentList] = await Promise.all([getPublishedSlides(), getPublicTournaments()]);
  const now = Date.now();
  const startsInFuture = (tournament: PublicTournamentSummary) =>
    tournament.startsAt === null || new Date(tournament.startsAt).getTime() >= now;
  return {
    slides,
    featured: tournamentList.filter((tournament) => tournament.featured && tournament.status !== "completed"),
    registrationOpen: tournamentList.filter((tournament) => tournament.status === "registration_open"),
    upcoming: tournamentList.filter((tournament) =>
      (tournament.status === "published" || tournament.status === "registration_open" || tournament.status === "registration_closed")
      && startsInFuture(tournament)),
    liveNow: tournamentList.filter((tournament) => tournament.status === "live"),
    recentResults: tournamentList.filter((tournament) => tournament.status === "completed").slice(0, 5),
  };
}
