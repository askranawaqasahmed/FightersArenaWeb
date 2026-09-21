import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { UserRoundX } from "lucide-react";
import { db } from "@/db/client";
import { cities, games } from "@/db/schema";
import { getAdminGamer } from "@/lib/admin-gamer-data";
import { AdminGamerEditor } from "@/components/admin-gamer-editor";
import type { AchievementCategory } from "@/lib/achievement-labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Gamer" };

export default async function AdminGamerEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const gamer = await getAdminGamer(slug);
  if (!gamer) {
    return <main className="admin-content"><div className="account-empty card"><UserRoundX className="green" /><h1>Gamer not found</h1><p className="muted">This gamer cannot be edited because it does not exist.</p><Link className="button button-secondary" href="/admin/gamers">Back to gamers</Link></div></main>;
  }

  const [gameOptions, cityOptions] = await Promise.all([
    db.select({ id: games.id, name: games.name }).from(games).where(eq(games.active, true)).orderBy(asc(games.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.name)),
  ]);

  return <AdminGamerEditor
    gamer={{
      slug: gamer.slug,
      displayName: gamer.displayName,
      handle: gamer.handle,
      bio: gamer.bio,
      cityId: gamer.cityId,
      profileVisibility: gamer.profileVisibility,
      verificationStatus: gamer.verificationStatus,
      rankingPoints: gamer.rankingPoints,
      games: gamer.games.map((entry) => ({ gameId: entry.gameId, inGameName: entry.inGameName })),
      achievements: gamer.achievements.map((entry) => ({
        category: entry.category as AchievementCategory,
        title: entry.title,
        detail: entry.detail ?? "",
        gameId: entry.gameId ?? "",
        yearLabel: entry.yearLabel ?? "",
      })),
    }}
    gameOptions={gameOptions}
    cityOptions={cityOptions}
  />;
}
