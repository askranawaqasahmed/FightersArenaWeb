/** Local publisher artwork; custom artwork uploaded by an operator takes precedence. */
const illustratedGames = new Set([
  "kof-95", "kof-97", "kof-98-um", "kof-99", "kof-2000", "kof-2002",
  "kof-xiii", "kof-xiv", "kof-xv", "street-fighter-iv", "street-fighter-v",
  "street-fighter-6", "fatal-fury-cotw",
]);

export function gameArtwork(game: { slug: string; imageUrl: string | null }) {
  return game.imageUrl || (illustratedGames.has(game.slug) ? `/images/games/${game.slug}.jpg` : null);
}

export const arenaHighlights = [
  { id: "arena-sf6", eyebrow: "Your next challenge starts here", title: "Great players.\nGreater rivalries.", summary: "Find your competition. Meet your community. Build your legacy in Pakistan’s fighting game arena.", imageUrl: "/images/games/street-fighter-6-hero.jpg", imageAlt: "Street Fighter 6 gameplay", ctaLabel: "Explore tournaments", ctaUrl: "/tournaments", status: "published" as const, order: 1 },
  { id: "arena-kof", eyebrow: "From arcade roots to the main stage", title: "A new generation.\nThe same fighting spirit.", summary: "From classic King of Fighters to the latest releases, find the game that brings out your best.", imageUrl: "/images/games/kof-xv-hero.jpg", imageAlt: "The King of Fighters XV gameplay", ctaLabel: "Discover the games", ctaUrl: "/games", status: "published" as const, order: 2 },
  { id: "arena-fury", eyebrow: "Find your place in the arena", title: "Every rivalry\nstarts with you.", summary: "Create your player profile, follow competitions, and make your next match count.", imageUrl: "/images/games/fatal-fury-cotw-hero.jpg", imageAlt: "Fatal Fury City of the Wolves gameplay", ctaLabel: "Join the arena", ctaUrl: "/register", status: "published" as const, order: 3 },
];
