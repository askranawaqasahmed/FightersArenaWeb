import { seedId } from "./ids";

export type SeedGame = {
  key: string;
  id: string;
  slug: string;
  name: string;
  publisher: string;
  coverGradient: string;
};

const catalogue: Array<Omit<SeedGame, "id">> = [
  { key: "kof95", slug: "kof-95", name: "The King of Fighters '95", publisher: "SNK", coverGradient: "pink" },
  { key: "kof97", slug: "kof-97", name: "The King of Fighters '97", publisher: "SNK", coverGradient: "pink" },
  { key: "kof98um", slug: "kof-98-um", name: "The King of Fighters '98 Ultimate Match", publisher: "SNK", coverGradient: "pink" },
  { key: "kof99", slug: "kof-99", name: "The King of Fighters '99", publisher: "SNK", coverGradient: "pink" },
  { key: "kof2000", slug: "kof-2000", name: "The King of Fighters 2000", publisher: "SNK", coverGradient: "pink" },
  { key: "kof2002", slug: "kof-2002", name: "The King of Fighters 2002", publisher: "SNK", coverGradient: "pink" },
  { key: "kofxiii", slug: "kof-xiii", name: "The King of Fighters XIII", publisher: "SNK", coverGradient: "pink" },
  { key: "kofxiv", slug: "kof-xiv", name: "The King of Fighters XIV", publisher: "SNK", coverGradient: "pink" },
  { key: "kofxv", slug: "kof-xv", name: "The King of Fighters XV", publisher: "SNK", coverGradient: "pink" },
  { key: "sf4", slug: "street-fighter-iv", name: "Street Fighter IV", publisher: "Capcom", coverGradient: "blue" },
  { key: "sf5", slug: "street-fighter-v", name: "Street Fighter V", publisher: "Capcom", coverGradient: "blue" },
  { key: "sf6", slug: "street-fighter-6", name: "Street Fighter 6", publisher: "Capcom", coverGradient: "blue" },
  { key: "fatalfury", slug: "fatal-fury-cotw", name: "Fatal Fury: City of the Wolves", publisher: "SNK", coverGradient: "amber" },
];

export const seedGames: SeedGame[] = catalogue.map((game, index) => ({
  ...game,
  id: seedId(110 + index, 0),
}));

export const gameIdByKey: Record<string, string> = Object.fromEntries(
  seedGames.map((game) => [game.key, game.id]),
);
