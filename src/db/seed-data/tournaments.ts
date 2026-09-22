import { seedId } from "./ids";

export type DatePrecision = "day" | "year" | "unknown";

export type SeedTournament = {
  key: string;
  id: string;
  divisionId: string;
  slug: string;
  name: string;
  gameKey: string;
  competitionType: "tournament" | "league";
  /** Year the event took place; null when unknown. */
  year: number | null;
  description?: string;
  online?: boolean;
  /** Held outside Pakistan; only Pakistan is seeded as a country, so no country is recorded. */
  abroad?: boolean;
  /**
   * Added after go-live. The one-time content seed has already run in production, so
   * the player sync creates these once (see seed-babar.ts); the go-live seed still
   * creates them on a fresh database.
   */
  addedAfterGoLive?: true;
};

/**
 * Every named event appears here exactly once, even when several gamers competed in it.
 * Each gamer file then references the event by `key` and contributes its own placement,
 * so a shared tournament is never duplicated.
 * None of these have a bracket: they are historical results with no stage/match data.
 */
const events: Array<Omit<SeedTournament, "id" | "divisionId">> = [
  // Fatal Fury: City of the Wolves circuit
  { key: "takedown-2024", slug: "takedown-2024", name: "Takedown 2024", gameKey: "fatalfury", competitionType: "tournament", year: 2024 },
  { key: "takedown-2025", slug: "takedown-2025", name: "Takedown 2025", gameKey: "fatalfury", competitionType: "tournament", year: 2025 },
  { key: "takedown-2026", slug: "takedown-2026", name: "Takedown 2026", gameKey: "fatalfury", competitionType: "tournament", year: 2026 },
  { key: "emirates-showdown-2025", slug: "emirates-showdown-2025", name: "Emirates Showdown 2025", gameKey: "fatalfury", competitionType: "tournament", year: 2025 },
  { key: "snk-league-2025", slug: "snk-supported-league-2025", name: "SNK-Supported League 2025", gameKey: "fatalfury", competitionType: "league", year: 2025, description: "Team league supported by SNK." },
  { key: "road-to-takedown-2026", slug: "road-to-takedown-2026", name: "Road to Takedown 2026", gameKey: "fatalfury", competitionType: "tournament", year: 2026 },
  { key: "o2-karachi-showdown-2026", slug: "o2-esports-karachi-showdown-2026", name: "O2 Esports Karachi Showdown 2026", gameKey: "fatalfury", competitionType: "tournament", year: 2026, online: false },
  { key: "fighters-arena-showdown-2026", slug: "fighters-arena-showdown-2026", name: "Fighters Arena Showdown 2026", gameKey: "fatalfury", competitionType: "tournament", year: 2026 },
  { key: "swc-qualifier-2026", slug: "swc-online-regional-league-qualifier-2026", name: "SWC Online Regional League Qualifier 2026", gameKey: "fatalfury", competitionType: "league", year: 2026, description: "Team qualifier for the SNK World Championship regional league." },
  { key: "saudi-evo-france-2026", slug: "saudi-esports-league-road-to-evo-france-2026", name: "Saudi Esports League: Road to EVO France 2026", gameKey: "fatalfury", competitionType: "league", year: 2026 },
  { key: "esports-nations-cup-qualifier-2026", slug: "esports-nations-cup-qualifier-2026", name: "Esports Nations Cup Qualifier 2026", gameKey: "fatalfury", competitionType: "tournament", year: 2026 },
  { key: "fapl-1", slug: "fightersarena-premier-league-1-0", name: "FightersArena Premier League 1.0", gameKey: "fatalfury", competitionType: "league", year: null },
  { key: "gladiator-1", slug: "gladiator-1-0", name: "Gladiator 1.0", gameKey: "fatalfury", competitionType: "tournament", year: null },

  // Street Fighter
  { key: "fighters-frenzy-1", slug: "fighters-frenzy-vol-1", name: "Fighters Frenzy Vol. 1", gameKey: "sf6", competitionType: "tournament", year: null, description: "Organized by Baaz." },
  { key: "superfest-showdown", slug: "superfest-showdown", name: "SuperFest Showdown", gameKey: "sf6", competitionType: "tournament", year: null, description: "Organized by VSlash." },
  { key: "sf-league-pakistan-2022", slug: "street-fighter-league-pakistan-2022", name: "Street Fighter League Pakistan 2022", gameKey: "sf6", competitionType: "league", year: 2022 },
  { key: "chickenchips-2019", slug: "chickenchips-marriott-hotel-2019", name: "ChickenChips Marriott Hotel 2019", gameKey: "sf5", competitionType: "tournament", year: 2019, online: false },
  { key: "sfv-league", slug: "street-fighter-v-league", name: "Street Fighter V League", gameKey: "sf5", competitionType: "league", year: null },

  // King of Fighters
  { key: "karachi-showdown-2022", slug: "karachi-showdown-2022", name: "Karachi Showdown 2022", gameKey: "kofxv", competitionType: "tournament", year: 2022, online: false },
  { key: "arcadecafe-2014", slug: "arcadecafe-2014", name: "ArcadeCafe 2014", gameKey: "kof98um", competitionType: "tournament", year: 2014, online: false, description: "Sponsored by VSlash." },
  { key: "arcadecafe-2018", slug: "arcadecafe-2018", name: "ArcadeCafe 2018", gameKey: "kofxiii", competitionType: "tournament", year: 2018, online: false },
  { key: "cyberfanatics-kof98", slug: "cyberfanatics-kof98", name: "Cyberfanatics KOF98", gameKey: "kof98um", competitionType: "tournament", year: null },
  { key: "cyberfanatics-kof98-league", slug: "cyberfanatics-kof98-league", name: "Cyberfanatics KOF98 League", gameKey: "kof98um", competitionType: "league", year: null },
  { key: "kvl", slug: "karachi-vs-lahore", name: "Karachi vs Lahore (KVL)", gameKey: "kof98um", competitionType: "tournament", year: null },

  // Added after go-live. Always append: ids come from each event's position in this list.
  { key: "takedown-2023", slug: "takedown-season-1-2023", name: "Takedown Season 1 2023", gameKey: "kofxv", competitionType: "tournament", year: 2023, online: false, description: "Held in Lahore.", addedAfterGoLive: true },
  { key: "slash-and-dash-3-2022", slug: "3rd-slash-and-dash-2022", name: "3rd Slash and Dash 2022", gameKey: "kofxv", competitionType: "tournament", year: 2022, online: false, description: "Held in Lahore.", addedAfterGoLive: true },
  { key: "slash-and-dash-4-2022", slug: "4th-slash-and-dash-2022", name: "4th Slash and Dash 2022", gameKey: "kofxv", competitionType: "tournament", year: 2022, online: false, description: "Held in Lahore.", addedAfterGoLive: true },
  { key: "takra-cup-2022", slug: "takra-cup-2022", name: "Takra Cup 2022", gameKey: "kofxv", competitionType: "tournament", year: 2022, online: false, description: "Held in Islamabad.", addedAfterGoLive: true },
  { key: "emirates-showdown-2023", slug: "emirates-showdown-2023", name: "Emirates Showdown 2023", gameKey: "kofxv", competitionType: "tournament", year: 2023, online: false, abroad: true, description: "Held in Dubai, UAE.", addedAfterGoLive: true },
  { key: "kumite-2024", slug: "kumite-2024", name: "Kumite 2024", gameKey: "kofxv", competitionType: "tournament", year: 2024, online: false, description: "Held in Karachi.", addedAfterGoLive: true },
  { key: "saudi-fighting-league-2024", slug: "saudi-fighting-league-2024", name: "Saudi Fighting League 2024", gameKey: "kofxv", competitionType: "tournament", year: 2024, online: false, abroad: true, description: "Held in Riyadh, Saudi Arabia.", addedAfterGoLive: true },
  { key: "fv-major-2024", slug: "fv-major-2024", name: "FV Major 2024", gameKey: "kofxv", competitionType: "tournament", year: 2024, online: false, abroad: true, description: "Held in Malaysia.", addedAfterGoLive: true },
];

export const seedTournaments: SeedTournament[] = events.map((event, index) => ({
  ...event,
  id: seedId(1001 + index, 0),
  divisionId: seedId(2001 + index, 0),
}));

export const tournamentByKey: Record<string, SeedTournament> = Object.fromEntries(
  seedTournaments.map((tournament) => [tournament.key, tournament]),
);

export function datePrecisionFor(tournament: SeedTournament): DatePrecision {
  return tournament.year === null ? "unknown" : "year";
}

/** Year-only dates land at midday Pakistan time so the date never rolls across a time zone. */
export function startsAtFor(tournament: SeedTournament): Date | null {
  return tournament.year === null ? null : new Date(`${tournament.year}-01-01T12:00:00+05:00`);
}
