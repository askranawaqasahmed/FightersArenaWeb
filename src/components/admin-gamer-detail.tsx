"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Eye, KeyRound, MapPin, Pencil, ShieldCheck, Trophy, UserRoundX } from "lucide-react";
import { useState } from "react";
import { placementLabel } from "@/lib/placement";
import { achievementCategoryLabels, type AchievementCategory } from "@/lib/achievement-labels";
import type { GamerAccountStatus } from "@/lib/gamer-account-access";

export type AdminGamerDetailData = {
  slug: string;
  displayName: string;
  handle: string;
  bio: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  rankingPoints: number;
  verificationStatus: string;
  accountStatus: GamerAccountStatus;
  games: Array<{ gameId: string; game: string; inGameName: string; verified: boolean }>;
  achievements: Array<{ id: string; category: string; title: string; detail: string | null; yearLabel: string | null }>;
  placements: Array<{ tournamentName: string; gameName: string; year: number | null; finalRank: number | null; placementLabel: string | null }>;
};

function initialsFor(name: string) {
  return name.split(/\s+/).map((part) => part[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}

export function AdminGamerDetail({ gamer }: { gamer: AdminGamerDetailData }) {
  const router = useRouter();
  const [accountStatus, setAccountStatus] = useState<GamerAccountStatus>(gamer.accountStatus);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const isBlocked = accountStatus === "suspended";
  const canChangeAccess = accountStatus !== "deleted";

  async function changeAccess() {
    const nextStatus = isBlocked ? "active" as const : "suspended" as const;
    if (nextStatus === "suspended" && !window.confirm(`Block ${gamer.handle}? Every active gamer session will be signed out.`)) return;
    setLoading(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/gamers/${encodeURIComponent(gamer.slug)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "The gamer account status could not be changed.");
      setAccountStatus(body.data.status);
      setMessage(nextStatus === "suspended"
        ? `${gamer.handle} is blocked and all active sessions were revoked.`
        : `${gamer.handle} is unblocked and can sign in with a new session.`);
      router.refresh();
    } catch (accessError) {
      setError(true);
      setMessage(accessError instanceof Error ? accessError.message : "The gamer account status could not be changed.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!window.confirm(`Reset ${gamer.handle}'s password to 123456? They will be asked to choose a new one when they next sign in.`)) return;
    setLoading(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/gamers/${encodeURIComponent(gamer.slug)}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "The password could not be reset.");
      setMessage(`Temporary password set to ${body.data.password}. ${gamer.handle} must change it at the next sign-in.`);
    } catch (resetError) {
      setError(true);
      setMessage(resetError instanceof Error ? resetError.message : "The password could not be reset.");
    } finally {
      setLoading(false);
    }
  }

  const location = [gamer.city, gamer.country].filter(Boolean).join(", ");

  return <main className="admin-content">
    <Link className="text-link" href="/admin/gamers"><ArrowLeft size={14} /> Gamers</Link>
    <section className="card profile-hero admin-gamer-hero">
      <div className="avatar">{initialsFor(gamer.displayName)}</div>
      <div>
        <h1>{gamer.handle} {gamer.verificationStatus === "verified" && <BadgeCheck className="verified" size={23} />}</h1>
        <div className="muted">
          {gamer.displayName}
          {location && <> · <MapPin size={13} /> {location}</>}
          {gamer.games[0] && <> · {gamer.games[0].game}</>}
        </div>
      </div>
      <div className="header-actions">
        {canChangeAccess && <button className="button button-secondary" type="button" disabled={loading} onClick={changeAccess}><UserRoundX size={15} /> {loading ? "Saving…" : isBlocked ? "Unblock gamer" : "Block gamer"}</button>}
        <button className="button button-secondary" type="button" disabled={loading} onClick={resetPassword}><KeyRound size={15} /> Reset password</button>
        <Link className="button button-secondary" href={`/gamers/${gamer.slug}`}><Eye size={15} /> Public profile</Link>
        <Link className="button button-primary" href={`/admin/gamers/${gamer.slug}/edit`}><Pencil size={15} /> Edit gamer</Link>
      </div>
    </section>
    {message && <p className={`form-message ${error ? "form-error" : "form-success"}`} role="status">{message}</p>}
    <div className="profile-grid">
      <section className="card panel">
        <h2 className="panel-title"><Trophy size={17} /> Tournament results</h2>
        {gamer.placements.length === 0 ? (
          <p className="muted">No recorded results yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table player-history-table">
              <thead><tr><th>Year</th><th>Event</th><th>Game</th><th>Result</th></tr></thead>
              <tbody>{gamer.placements.map((entry) => <tr key={`${entry.tournamentName}-${entry.gameName}`}>
                <td>{entry.year ?? "—"}</td>
                <td><strong>{entry.tournamentName}</strong></td>
                <td className="muted">{entry.gameName}</td>
                <td><strong className={entry.finalRank === 1 ? "green" : undefined}>{placementLabel(entry.finalRank, entry.placementLabel)}</strong></td>
              </tr>)}</tbody>
            </table>
          </div>
        )}

        {gamer.achievements.length > 0 && (
          <>
            <h2 className="panel-title" style={{ marginTop: 28 }}><BadgeCheck size={17} /> Career highlights</h2>
            {gamer.achievements.map((entry) => (
              <div className="achievement" key={entry.id}>
                <div>
                  <strong>{entry.title}</strong>
                  <div className="muted">{[achievementCategoryLabels[entry.category as AchievementCategory] ?? entry.category, entry.detail].filter(Boolean).join(" · ")}</div>
                </div>
                {entry.yearLabel && <strong>{entry.yearLabel}</strong>}
              </div>
            ))}
          </>
        )}
      </section>

      <aside className="card panel">
        <h2 className="panel-title"><ShieldCheck size={17} /> Account details</h2>
        {gamer.bio && <p className="muted">{gamer.bio}</p>}
        <div className="achievement"><span>Sign-in email</span><strong>{gamer.email ?? "Not set"}</strong></div>
        <div className="achievement"><span>Mobile</span><strong>{gamer.phone ?? "Not set"}</strong></div>
        <div className="achievement"><span>Ranking points</span><strong className="green">{gamer.rankingPoints.toLocaleString()}</strong></div>
        <div className="achievement"><span>Verification</span><strong>{gamer.verificationStatus}</strong></div>
        <div className="achievement"><span>Account</span><strong><span className={`status ${isBlocked || accountStatus === "deleted" ? "danger" : accountStatus === "pending" ? "pending" : ""}`}>{accountStatus.toUpperCase()}</span></strong></div>

        {gamer.games.length > 0 && (
          <>
            <h2 className="panel-title" style={{ marginTop: 24 }}>Game identities</h2>
            {gamer.games.map((entry) => (
              <div className="achievement" key={entry.gameId}>
                <div><strong>{entry.game}</strong>{entry.verified && <div className="muted">Verified</div>}</div>
                <strong>{entry.inGameName}</strong>
              </div>
            ))}
          </>
        )}
      </aside>
    </div>
  </main>;
}
