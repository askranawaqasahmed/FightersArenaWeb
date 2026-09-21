/**
 * Fixed UUIDs keep the seed idempotent across re-runs (`make start` re-seeds every boot).
 * Block layout, continuing the original scheme:
 *   ...0001/0011-0013  reference country + cities
 *   ...0110-0122       games
 *   ...0301            superadmin
 *   ...0311+           seeded gamer users
 *   ...0321+           seeded gamer profiles
 *   ...0601+           sponsors
 *   ...1001+           tournaments
 *   ...2001+           divisions
 *   ...3001+           participant snapshots
 *   ...4001+           achievements
 */

export const referenceIds = {
  pakistan: "00000000-0000-4000-8000-000000000001",
  karachi: "00000000-0000-4000-8000-000000000011",
  lahore: "00000000-0000-4000-8000-000000000012",
  islamabad: "00000000-0000-4000-8000-000000000013",
  superAdmin: "00000000-0000-4000-8000-000000000301",
} as const;

/** Demo rows created by the original seed; removed by `npm run db:cleanup-demo`. */
export const demoIds = {
  dota: "00000000-0000-4000-8000-000000000101",
  valorant: "00000000-0000-4000-8000-000000000102",
  tekken: "00000000-0000-4000-8000-000000000103",
  pubg: "00000000-0000-4000-8000-000000000104",
  national: "00000000-0000-4000-8000-000000000201",
  proLeague: "00000000-0000-4000-8000-000000000202",
  gamerUser: "00000000-0000-4000-8000-000000000302",
  gamerProfile: "00000000-0000-4000-8000-000000000303",
} as const;

export const demoGameSlugs = ["dota-2", "valorant", "tekken-8", "pubg-mobile"] as const;
export const demoTournamentSlugs = ["national-championship-2026", "pakistan-pro-league-2026"] as const;
export const demoSponsorSlugs = ["vertex", "pulse-energy", "nexus-gear"] as const;
export const demoGamerSlug = "nova";
export const demoGamerPhone = "+923001234567";
export const demoSlideTitle = "The arena belongs to the fearless.";

/** Marker written to audit_events once the go-live content seed has run. */
export const GO_LIVE_SEED_ACTION = "seed.golive_v1";

/** Builds a fixed UUID inside one of the blocks above. */
export function seedId(block: number, index: number): string {
  const suffix = (block * 1000 + index).toString().padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}
