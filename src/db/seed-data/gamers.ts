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
  email: string;
  phone: string;
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
    email: "hazz@fightersarena.com",
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
    phone: "+923212281481",
    gameKeys: ["kof95", "kof97", "kof98um", "kof99", "kof2000", "kof2002", "kofxiii", "sf5", "fatalfury"],
    placements: [
      { tournamentKey: "takedown-2025", finalRank: 7 },
      { tournamentKey: "takedown-2026", finalRank: 5 },
      { tournamentKey: "snk-league-2025", finalRank: 1, teammates: ["Hazz"] },
      { tournamentKey: "road-to-takedown-2026", finalRank: 3 },
      { tournamentKey: "o2-karachi-showdown-2026", finalRank: 6 },
      { tournamentKey: "fighters-arena-showdown-2026", finalRank: null, placementLabel: "Finalist" },
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
      { category: "milestone", title: "First player from Pakistan to secure an international sponsorship" },
      { category: "highlight", title: "Takedown — Top 8", gameKey: "fatalfury" },
      { category: "coaching", title: "Hazz" },
      { category: "coaching", title: "Babarzaki" },
      { category: "coaching", title: "Team Maiden Mature" },
      { category: "coaching", title: "Team Yagami Syndicate" },
      { category: "player_developed", title: "MehtabKai", detail: "KOF97 and KOF98, KPL 3.0." },
      { category: "player_developed", title: "KamranBilly", detail: "Dubai tournament, 3rd position." },
      { category: "player_developed", title: "HammadKhan", detail: "Dubai tournament, 3rd position." },
      { category: "player_developed", title: "Farhan", detail: "KOF99 KPL 1.0 Champion; Cyberfanatics KOF98 Runner-up." },
    ],
  },
];

export const seedSponsor = {
  id: seedId(601, 0),
  slug: "vslash",
  name: "VSlash",
  category: "Esports",
};
