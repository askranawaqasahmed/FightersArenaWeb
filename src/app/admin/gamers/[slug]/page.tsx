import Link from "next/link";
import { UserRoundX } from "lucide-react";
import { getAdminGamer, getAdminGamerPlacements } from "@/lib/admin-gamer-data";
import { AdminGamerDetail } from "@/components/admin-gamer-detail";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gamer Details" };

export default async function AdminGamerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = await getAdminGamer(slug);
  if (!gamer) {
    return <main className="admin-content"><div className="account-empty card"><UserRoundX className="green" /><h1>Gamer not found</h1><p className="muted">This gamer does not exist or was removed.</p><Link className="button button-secondary" href="/admin/gamers">Back to gamers</Link></div></main>;
  }
  const placements = await getAdminGamerPlacements(gamer.id);

  return <AdminGamerDetail gamer={{
    slug: gamer.slug,
    displayName: gamer.displayName,
    handle: gamer.handle,
    bio: gamer.bio,
    email: gamer.email,
    phone: gamer.phone,
    city: gamer.city,
    country: gamer.country,
    rankingPoints: gamer.rankingPoints,
    verificationStatus: gamer.verificationStatus,
    accountStatus: gamer.accountStatus,
    games: gamer.games.map((entry) => ({
      gameId: entry.gameId,
      game: entry.game,
      inGameName: entry.inGameName,
      verified: entry.verified,
    })),
    achievements: gamer.achievements.map((entry) => ({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      detail: entry.detail,
      yearLabel: entry.yearLabel,
    })),
    placements,
  }} />;
}
