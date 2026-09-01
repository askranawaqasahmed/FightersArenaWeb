import { ManagedGameDetail } from "@/components/managed-game-detail";
import { featuredGames } from "@/lib/demo-data";

export function generateStaticParams() { return featuredGames.map((game) => ({ slug: game.slug })); }

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ManagedGameDetail slug={slug} />;
}
