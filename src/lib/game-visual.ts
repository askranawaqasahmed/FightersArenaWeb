import type { PublicGame } from "./game-data";

const gameVisuals: Record<string, { accent: string; secondary: string; preview: string }> = {
  "kof-98-um": { accent: "#e52dff", secondary: "#33204d", preview: "fighting" },
  "street-fighter-6": { accent: "#1e90ff", secondary: "#19354d", preview: "fighting" },
  "fatal-fury-cotw": { accent: "#ffb020", secondary: "#3b301b", preview: "fighting" },
};

export function gameVisual(game: Pick<PublicGame, "slug" | "genre">) {
  if (gameVisuals[game.slug]) return gameVisuals[game.slug];
  const genre = game.genre.toLowerCase();
  const preview = genre.includes("fight") ? "fighting" : genre.includes("shooter") || genre.includes("fps") ? "tactical" : "generic";
  return { accent: "#1e90ff", secondary: "#19354d", preview };
}

