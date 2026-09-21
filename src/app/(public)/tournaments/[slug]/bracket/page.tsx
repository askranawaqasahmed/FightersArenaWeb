import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PublicLiveBracket } from "@/components/public-live-bracket";
import { ShareButton } from "@/components/share-button";
import { getPublicBracket, getPublicTournament } from "@/lib/public-tournament-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const detail = await getPublicTournament((await params).slug);
  return { title: detail ? `${detail.name} — Bracket` : "Bracket" };
}

export default async function TournamentBracketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { slug } = await params;
  const requestedDivision = (await searchParams).division;
  const detail = await getPublicTournament(slug);
  // An event recorded without a bracket has no bracket page.
  if (!detail || !detail.hasBracket) notFound();
  const view = await getPublicBracket(slug, requestedDivision);
  if (!view) notFound();
  const isLive = view.division.status === "live";

  return (
    <div className="page-shell">
      <div className="container">
        <Link className="back-link" href={`/tournaments/${slug}`}><ArrowLeft size={15} /> {view.tournament.name}</Link>
        <span className={`status ${isLive ? "live" : ""}`}>{isLive && <span className="live-dot" />}{view.division.statusLabel}</span>
        <h1 className="page-title">{view.division.name}</h1>
        <p className="lede">{view.division.game} · {view.division.formatLabel}{view.division.bestOf ? ` · Best of ${view.division.bestOf}` : ""} · {view.division.participants} participants</p>

        {detail.divisionList.length > 1 && (
          <div className="filter-bar" aria-label="Choose a competition">
            {detail.divisionList.map((division) => (
              <Link
                key={division.id}
                className={`filter-chip${division.id === view.division.id ? " active" : ""}`}
                href={`/tournaments/${slug}/bracket?division=${division.id}`}
              >
                {division.name}
              </Link>
            ))}
            <ShareButton title={`${view.tournament.name} — ${view.division.name}`} />
          </div>
        )}

        {view.division.bracketAvailable
          ? <PublicLiveBracket slug={slug} divisionId={view.division.id} initialView={view} />
          : (
            <div className="card account-empty">
              <h2>The bracket is not published yet</h2>
              <p className="muted">This competition has not started. The bracket, matches and standings appear here the moment the organizer starts it.</p>
              <Link className="button button-secondary" href={`/tournaments/${slug}`}>Back to event</Link>
            </div>
          )}
      </div>
    </div>
  );
}
