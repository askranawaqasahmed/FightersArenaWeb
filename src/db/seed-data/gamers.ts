import { seedId } from "./ids";

export type SeedPlacement = {
  /** Key from seed-data/tournaments.ts — shared events are referenced, never duplicated. */
  tournamentKey: string;
  /** 1 = Champion, 2 = Runner-up, n = Top n. Null when only a label is known. */
  finalRank: number | null;
  /** Overrides the rank label, e.g. "Finalist" when the exact rank is unknown. */
  placementLabel?: string;
  /** Teammates for team events, recorded on the snapshot roster. */
  teammates?: string[];
};

export type SeedAchievement = {
  category: "milestone" | "highlight" | "coaching" | "player_developed";
  title: string;
  detail?: string;
  gameKey?: string;
  yearLabel?: string;
};

export type SeedGamer = {
  key: string;
  userId: string;
  profileId: string;
  slug: string;
  handle: string;
  /** Legal/display name when it differs from the competitive handle. */
  displayName?: string;
  email: string;
  phone: string;
  /** Short public intro shown under the name on the profile and in the PDF. */
  bio?: string;
  /** Static portrait under public/. Operator uploads overwrite this later. */
  avatarUrl?: string;
  /** A designed profile PDF under public/profiles; when set it replaces the generated one. */
  profilePdfUrl?: string;
  gameKeys: string[];
  placements: SeedPlacement[];
  achievements: SeedAchievement[];
};

export const seedGamers: SeedGamer[] = [
  {
    key: "hazz",
    userId: seedId(311, 0),
    profileId: seedId(321, 0),
    slug: "hazz",
    handle: "Hazz",
    displayName: "Hassan Baig",
    email: "hazz@fightersarena.com",
    bio: "Competitive esports player. Fatal Fury: City of the Wolves specialist with a decade in Pakistan's fighting game scene, previously undefeated across his King of Fighters 2002 run.",
    avatarUrl: "/images/gamers/hazz.jpg",
    profilePdfUrl: "/profiles/hazz.pdf",
    phone: "+923431263350",
    gameKeys: ["kof2002", "kofxv", "sf6", "fatalfury"],
    placements: [
      { tournamentKey: "takedown-2024", finalRank: 2 },
      { tournamentKey: "takedown-2025", finalRank: 1 },
      { tournamentKey: "takedown-2026", finalRank: 2 },
      { tournamentKey: "emirates-showdown-2025", finalRank: 1 },
      { tournamentKey: "snk-league-2025", finalRank: 1, teammates: ["Kashif Yagami"] },
      { tournamentKey: "road-to-takedown-2026", finalRank: 1 },
      { tournamentKey: "o2-karachi-showdown-2026", finalRank: 1 },
      { tournamentKey: "fighters-arena-showdown-2026", finalRank: 1 },
      { tournamentKey: "swc-qualifier-2026", finalRank: 1, teammates: ["Kashif Yagami"] },
      { tournamentKey: "saudi-evo-france-2026", finalRank: 1 },
      { tournamentKey: "esports-nations-cup-qualifier-2026", finalRank: 1 },
      { tournamentKey: "fighters-frenzy-1", finalRank: 1 },
      { tournamentKey: "superfest-showdown", finalRank: 1 },
      { tournamentKey: "sf-league-pakistan-2022", finalRank: 1 },
      { tournamentKey: "karachi-showdown-2022", finalRank: 1 },
    ],
    achievements: [
      { category: "milestone", title: "Undefeated across his competitive KOF 2002 run", detail: "Active competitor from 2014 to 2019 and never beaten in that period.", gameKey: "kof2002", yearLabel: "2014–2019" },
      { category: "highlight", title: "3× tournament Champion", detail: "Won all three KOF 2002 tournaments he entered.", gameKey: "kof2002", yearLabel: "2014–2019" },
      { category: "highlight", title: "Undefeated in exhibition matches", detail: "Never beaten in exhibitions against leading Pakistani KOF players.", gameKey: "kof2002", yearLabel: "2014–2019" },
      { category: "highlight", title: "Multiple tournament runner-up finishes", gameKey: "kofxv" },
      { category: "highlight", title: "Multiple competitive tournament appearances and match wins", gameKey: "sf6" },
    ],
  },
  {
    key: "kashif",
    userId: seedId(312, 0),
    profileId: seedId(322, 0),
    slug: "kashif-yagami",
    handle: "Kashif Yagami",
    email: "kashif@fightersarena.com",
    bio: "Competitive esports player, coach and mentor. More than 25 years in competitive fighting games, and one of the earliest Pakistani fighting-game competitors to secure international sponsorship.",
    avatarUrl: "/images/gamers/kashif-yagami.jpg",
    profilePdfUrl: "/profiles/kashif-yagami.pdf",
    phone: "+923212281481",
    gameKeys: ["kof95", "kof97", "kof98um", "kof99", "kof2000", "kof2002", "kofxiii", "sf5", "fatalfury"],
    placements: [
      { tournamentKey: "takedown-2025", finalRank: 7 },
      { tournamentKey: "takedown-2026", finalRank: 5 },
      { tournamentKey: "snk-league-2025", finalRank: 1, teammates: ["Hazz"] },
      { tournamentKey: "road-to-takedown-2026", finalRank: 3 },
      { tournamentKey: "o2-karachi-showdown-2026", finalRank: 6 },
      { tournamentKey: "fighters-arena-showdown-2026", finalRank: 3 },
      { tournamentKey: "swc-qualifier-2026", finalRank: 1, teammates: ["Hazz"] },
      { tournamentKey: "arcadecafe-2014", finalRank: 2 },
      { tournamentKey: "arcadecafe-2018", finalRank: 8 },
      { tournamentKey: "chickenchips-2019", finalRank: 3 },
      { tournamentKey: "cyberfanatics-kof98", finalRank: 1 },
      { tournamentKey: "cyberfanatics-kof98-league", finalRank: 1 },
      { tournamentKey: "kvl", finalRank: 1 },
      { tournamentKey: "sfv-league", finalRank: 1 },
      { tournamentKey: "fapl-1", finalRank: 1 },
      { tournamentKey: "gladiator-1", finalRank: 3 },
    ],
    achievements: [
      { category: "milestone", title: "25+ years competing", detail: "Over twenty-five years in competitive fighting games." },
      { category: "milestone", title: "One of the earliest Pakistani fighting-game competitors to secure international sponsorship" },
      { category: "highlight", title: "Takedown — Top 8", gameKey: "fatalfury" },
      { category: "coaching", title: "Hazz" },
      { category: "coaching", title: "Babarzaki" },
      { category: "coaching", title: "Team Maiden Mature" },
      { category: "coaching", title: "Team Yagami Syndicate" },
      // Named individuals are deliberately left out here: this section describes the
      // contribution, not other people's profiles, matching the wording of his own
      // career profile document.
      { category: "player_developed", title: "Tournament preparation", detail: "Helping players prepare for pressure, set structure, adaptation and match readiness." },
      { category: "player_developed", title: "Matchup and strategy", detail: "Guidance in opponent tendencies, character knowledge and game-plan refinement." },
      { category: "player_developed", title: "Long-term development", detail: "Supporting steady improvement through practice structure, discipline and review." },
      { category: "player_developed", title: "Competitive mentorship", detail: "Providing coaching support that helps players become more confident and independent decision-makers." },
      // Appended after go-live: ids come from position, so new entries go last.
      { category: "highlight", title: "KOF XIV — 3rd place", gameKey: "kofxiv", yearLabel: "2018" },
      { category: "coaching", title: "Cyberfanatics — KOF 98 team", detail: "Runner-up. A team-development result rather than an individual one.", gameKey: "kof98um" },
    ],
  },
  {
    key: "babar",
    userId: seedId(313, 0),
    profileId: seedId(323, 0),
    slug: "babarzaki",
    handle: "Babarzaki",
    displayName: "Syed Babar Ali",
    email: "babar@fightersarena.com",
    bio: "Competitive esports player. Fatal Fury: City of the Wolves competitor on Pakistan's national circuit, with podium finishes across the 2025 and 2026 seasons.",
    avatarUrl: "/images/gamers/babarzaki.jpg",
    profilePdfUrl: "/profiles/babarzaki.pdf",
    phone: "+923000000003",
    gameKeys: ["fatalfury"],
    placements: [
      { tournamentKey: "takedown-2025", finalRank: 2 },
      { tournamentKey: "takedown-2026", finalRank: 9 },
      { tournamentKey: "snk-league-2025", finalRank: 3 },
      { tournamentKey: "road-to-takedown-2026", finalRank: 2 },
      { tournamentKey: "o2-karachi-showdown-2026", finalRank: 2 },
      { tournamentKey: "fighters-arena-showdown-2026", finalRank: 3 },
      { tournamentKey: "swc-qualifier-2026", finalRank: 9 },
      { tournamentKey: "saudi-evo-france-2026", finalRank: 7 },
      { tournamentKey: "esports-nations-cup-qualifier-2026", finalRank: 7 },
    ],
    achievements: [
      { category: "milestone", title: "Podium finish in six consecutive seasons events", detail: "Runner-up or better at four events across the 2025 and 2026 Fatal Fury seasons.", gameKey: "fatalfury", yearLabel: "2025–2026" },
      { category: "highlight", title: "4× tournament runner-up", detail: "Second place at Takedown 2025, Road to Takedown 2026 and O2 Esports Karachi Showdown 2026.", gameKey: "fatalfury", yearLabel: "2025–2026" },
      { category: "highlight", title: "International qualifier campaigns", detail: "Top 7 at both the Saudi Esports League: Road to EVO France 2026 and the Esports Nations Cup Qualifier 2026.", gameKey: "fatalfury", yearLabel: "2026" },
    ],
  },
  {
    key: "farhan",
    userId: seedId(314, 0),
    profileId: seedId(324, 0),
    slug: "farhanchin",
    handle: "Farhanchin",
    displayName: "Hafiz Muhammad Farhan",
    email: "farhanchin@fightersarena.com",
    bio: "Competitive esports player. Pakistani fighting-game competitor with four consecutive Takedown appearances from 2023 to 2026 and a podium finish at the SWC Online Qualifier.",
    profilePdfUrl: "/profiles/farhanchin.pdf",
    phone: "+923000000004",
    gameKeys: ["kofxv", "fatalfury", "sf6"],
    placements: [
      { tournamentKey: "takedown-2023", finalRank: 17 },
      { tournamentKey: "takedown-2024", finalRank: 9 },
      { tournamentKey: "takedown-2025", finalRank: 7 },
      { tournamentKey: "takedown-2026", finalRank: 13 },
      { tournamentKey: "superfest-showdown", finalRank: 4 },
      { tournamentKey: "snk-league-2025", finalRank: 5 },
      { tournamentKey: "swc-qualifier-2026", finalRank: 3 },
    ],
    achievements: [
      { category: "milestone", title: "Four consecutive Takedown appearances", detail: "Competed at every Takedown from 2023 to 2026, with a best finish of 7th in 2025.", yearLabel: "2023–2026" },
    ],
  },
  {
    key: "kami",
    userId: seedId(315, 0),
    profileId: seedId(325, 0),
    slug: "kami-jones",
    handle: "Kami Jones",
    displayName: "Kamran Ahmed",
    email: "kami@fightersarena.com",
    bio: "Competitive esports player. The King of Fighters XV competitor with seven tournament championships from 2022 to 2024, including wins in Riyadh and Dubai.",
    profilePdfUrl: "/profiles/kami-jones.pdf",
    phone: "+923000000005",
    gameKeys: ["kofxv"],
    placements: [
      { tournamentKey: "slash-and-dash-3-2022", finalRank: 1 },
      { tournamentKey: "slash-and-dash-4-2022", finalRank: 1 },
      { tournamentKey: "takra-cup-2022", finalRank: 1 },
      { tournamentKey: "takedown-2023", finalRank: 1 },
      { tournamentKey: "emirates-showdown-2023", finalRank: 1 },
      { tournamentKey: "kumite-2024", finalRank: 1 },
      { tournamentKey: "saudi-fighting-league-2024", finalRank: 1 },
      { tournamentKey: "fv-major-2024", finalRank: 2 },
    ],
    achievements: [
      { category: "milestone", title: "7× tournament Champion", detail: "Seven championships across Pakistan, Saudi Arabia and the UAE between 2022 and 2024.", gameKey: "kofxv", yearLabel: "2022–2024" },
      { category: "highlight", title: "International podiums", detail: "Champion at Saudi Fighting League 2024 and Emirates Showdown 2023, runner-up at FV Major 2024.", gameKey: "kofxv", yearLabel: "2023–2024" },
    ],
  },
];

export const seedSponsor = {
  id: seedId(601, 0),
  slug: "vslash",
  name: "VSlash",
  category: "Esports",
};
