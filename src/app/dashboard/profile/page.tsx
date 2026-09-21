import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db } from "@/db/client";
import { cities, games } from "@/db/schema";
import { listOwnAchievements } from "@/lib/achievements";
import { requireGamerWithOwnPassword } from "@/lib/gamer-guard";
import { getOwnProfile } from "@/lib/me-data";
import { DashboardProfileEditor } from "@/components/dashboard-profile-editor";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const account = await requireGamerWithOwnPassword();
  const profile = await getOwnProfile(account.userId);
  if (!profile) redirect("/dashboard");

  const [gameOptions, cityOptions, achievements] = await Promise.all([
    db.select({ id: games.id, name: games.name }).from(games).where(eq(games.active, true)).orderBy(asc(games.name)),
    db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.name)),
    listOwnAchievements(account.userId),
  ]);

  return (
    <div className="page-shell">
      <div className="container">
        <header className="section-heading">
          <h1>Edit profile</h1>
          <p className="muted">
            This is what visitors see at{" "}
            <Link className="text-link" href={`/gamers/${profile.slug}`}>
              /gamers/{profile.slug} <ExternalLink size={12} />
            </Link>
          </p>
        </header>
        <DashboardProfileEditor
          profile={{
            slug: profile.slug,
            displayName: profile.displayName,
            handle: profile.handle,
            bio: profile.bio,
            cityId: profile.cityId,
            profileVisibility: profile.profileVisibility,
          }}
          games={profile.games.map((entry) => ({
            gameId: entry.gameId,
            inGameName: entry.inGameName,
            primaryRole: entry.primaryRole,
            platform: entry.platform,
          }))}
          achievements={achievements.map((entry) => ({
            id: entry.id,
            category: entry.category,
            title: entry.title,
            detail: entry.detail,
            gameId: entry.gameId,
            yearLabel: entry.yearLabel,
          }))}
          gameOptions={gameOptions}
          cityOptions={cityOptions}
        />
      </div>
    </div>
  );
}
