import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getPublicTournament } from "@/lib/public-tournament-data";
import { parseYouTubeId, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const detail = await getPublicTournament((await params).slug);
  return { title: detail ? `Watch ${detail.name}` : "Watch" };
}

export default async function WatchTournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPublicTournament(slug);
  if (!detail) notFound();

  const videoId = parseYouTubeId(detail.youtubeUrl);
  if (!videoId) notFound();

  return (
    <div className="page-shell">
      <div className="container">
        <Link className="text-link" href={`/tournaments/${detail.slug}`}><ArrowLeft size={14} /> {detail.name}</Link>
        <h1 className="page-title">Watch {detail.name}</h1>
        <p className="lede">{detail.date}{detail.game ? ` · ${detail.game}` : ""}</p>

        <div className="video-frame">
          <iframe
            src={youtubeEmbedUrl(videoId)}
            title={`${detail.name} on YouTube`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>

        <div className="filter-bar" style={{ marginTop: 18 }}>
          <a className="button button-secondary button-small" href={youtubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
            Open on YouTube <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
