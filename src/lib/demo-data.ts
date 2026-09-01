export const platformStats = [
  { label: "Registered gamers", value: "12,840", delta: "+18% this month" },
  { label: "Active teams", value: "946", delta: "Across 18 cities" },
  { label: "Tournaments", value: "124", delta: "31 live or upcoming" },
  { label: "Verified sponsors", value: "58", delta: "12 new partnerships" },
] as const;

export const featuredGames = [
  { slug: "dota-2", name: "Dota 2", genre: "MOBA", players: 4260, color: "green", mark: "D2" },
  { slug: "valorant", name: "VALORANT", genre: "Tactical FPS", players: 3184, color: "blue", mark: "VL" },
  { slug: "tekken-8", name: "Tekken 8", genre: "Fighting", players: 1980, color: "pink", mark: "T8" },
  { slug: "pubg-mobile", name: "PUBG Mobile", genre: "Battle Royale", players: 3416, color: "amber", mark: "PM" },
] as const;

export const featuredGamers = [
  { slug: "nova", handle: "NOVA", name: "Areeb Khan", city: "Karachi", game: "Dota 2", rank: 1, points: 9820, initials: "AK", trend: "+3" },
  { slug: "viper", handle: "VIPER", name: "Hassan Raza", city: "Lahore", game: "VALORANT", rank: 2, points: 9485, initials: "HR", trend: "+1" },
  { slug: "raven", handle: "RAVEN", name: "Sara Malik", city: "Islamabad", game: "Tekken 8", rank: 3, points: 9110, initials: "SM", trend: "+7" },
  { slug: "frost", handle: "FROST", name: "Ali Noor", city: "Peshawar", game: "PUBG Mobile", rank: 4, points: 8840, initials: "AN", trend: "—" },
] as const;

export const tournaments = [
  {
    slug: "national-championship-2026",
    name: "National Championship 2026",
    game: "Dota 2",
    status: "LIVE",
    date: "Aug 18–24, 2026",
    teams: 16,
    prize: "PKR 5,000,000",
    format: "Groups → Double Elimination",
    progress: 64,
  },
  {
    slug: "city-clash-valorant",
    name: "City Clash: VALORANT",
    game: "VALORANT",
    status: "REGISTERING",
    date: "Sep 06–12, 2026",
    teams: 32,
    prize: "PKR 2,000,000",
    format: "Swiss → Single Elimination",
    progress: 38,
  },
  {
    slug: "iron-fist-league",
    name: "Iron Fist League",
    game: "Tekken 8",
    status: "UPCOMING",
    date: "Sep 20, 2026",
    teams: 64,
    prize: "PKR 800,000",
    format: "Double Elimination",
    progress: 0,
  },
] as const;

export const bracketRounds = [
  {
    name: "Quarterfinals",
    matches: [
      { code: "QF1", teamA: "Cipher", teamB: "Northwind", scoreA: 2, scoreB: 0, live: false },
      { code: "QF2", teamA: "Volt", teamB: "Aegis", scoreA: 2, scoreB: 1, live: false },
      { code: "QF3", teamA: "Riftwalkers", teamB: "Orbit", scoreA: 1, scoreB: 1, live: true },
      { code: "QF4", teamA: "Zenith", teamB: "Ember", scoreA: 0, scoreB: 0, live: false },
    ],
  },
  {
    name: "Semifinals",
    matches: [
      { code: "SF1", teamA: "Cipher", teamB: "Volt", scoreA: 0, scoreB: 0, live: false },
      { code: "SF2", teamA: "TBD", teamB: "TBD", scoreA: 0, scoreB: 0, live: false },
    ],
  },
  {
    name: "Grand Final",
    matches: [
      { code: "GF", teamA: "TBD", teamB: "TBD", scoreA: 0, scoreB: 0, live: false },
    ],
  },
] as const;

export const sponsorsData = ["Vertex", "Pulse Energy", "Quantum", "Nexus Gear", "HyperNet"] as const;
