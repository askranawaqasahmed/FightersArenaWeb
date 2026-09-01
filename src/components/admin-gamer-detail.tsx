"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Eye, MapPin, Pencil, ShieldCheck, Trophy, UserRoundX } from "lucide-react";
import { useState } from "react";
import { persistManagedGamers, readManagedGamers, useManagedGamers } from "./managed-gamers";
import type { GamerAccountStatus } from "@/lib/gamer-account-access";

export function AdminGamerDetail({ slug, initialAccountStatus = null }: { slug: string; initialAccountStatus?: GamerAccountStatus | null }) {
  const router = useRouter();
  const gamer = useManagedGamers().find((item) => item.slug === slug);
  const [accountStatusOverride, setAccountStatusOverride] = useState<GamerAccountStatus>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  if (!gamer) return <main className="admin-content"><div className="account-empty card"><UserRoundX className="green" /><h1>Gamer not found</h1><p className="muted">This gamer does not exist or was removed.</p><Link className="button button-secondary" href="/admin/gamers">Back to gamers</Link></div></main>;
  const currentGamer = gamer;
  const accountStatus = accountStatusOverride ?? initialAccountStatus ?? gamer.accountStatus;
  const canChangeAccess = initialAccountStatus !== null && accountStatus !== "deleted";
  const isBlocked = accountStatus === "suspended";

  async function changeAccess() {
    const nextStatus = isBlocked ? "active" as const : "suspended" as const;
    if (nextStatus === "suspended" && !window.confirm(`Block ${currentGamer.handle}? Every active gamer session will be signed out.`)) return;
    setLoading(true);
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/gamers/${encodeURIComponent(slug)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "The gamer account status could not be changed.");
      setAccountStatusOverride(body.data.status);
      persistManagedGamers(readManagedGamers().map((item) => item.slug === slug
        ? { ...item, accountStatus: body.data.status }
        : item));
      setMessage(nextStatus === "suspended"
        ? `${currentGamer.handle} is blocked and all active sessions were revoked.`
        : `${currentGamer.handle} is unblocked and can sign in with a new session.`);
      router.refresh();
    } catch (accessError) {
      setError(true);
      setMessage(accessError instanceof Error ? accessError.message : "The gamer account status could not be changed.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="admin-content">
    <Link className="text-link" href="/admin/gamers"><ArrowLeft size={14} /> Gamers</Link>
    <section className="card profile-hero admin-gamer-hero"><div className="avatar">{gamer.initials}</div><div><div className="eyebrow">National rank #{gamer.rank}</div><h1>{gamer.handle} {gamer.verificationStatus === "verified" && <BadgeCheck className="verified" size={23} />}</h1><div className="muted">{gamer.name} · <MapPin size={13} /> {gamer.city}, Pakistan · {gamer.game}</div></div><div className="header-actions">{canChangeAccess && <button className="button button-secondary" type="button" disabled={loading} onClick={changeAccess}><UserRoundX size={15} /> {loading ? "Saving…" : isBlocked ? "Unblock gamer" : "Block gamer"}</button>}<Link className="button button-secondary" href={`/gamers/${gamer.slug}`}><Eye size={15} /> Public profile</Link><Link className="button button-primary" href={`/admin/gamers/${gamer.slug}/edit`}><Pencil size={15} /> Edit gamer</Link></div></section>
    {message && <p className={`form-message ${error ? "form-error" : "form-success"}`} role="status">{message}</p>}
    <div className="profile-grid"><section className="card panel"><h2 className="panel-title"><Trophy size={17} /> Player history</h2><p className="muted">Verified results and match history are kept together on the player record.</p><div className="table-scroll"><table className="data-table player-history-table"><thead><tr><th>Date</th><th>Event</th><th>Opponent</th><th>Result</th><th>Score</th></tr></thead><tbody>{gamer.matchHistory.map((match) => <tr key={match.id}><td>{match.playedAt}</td><td><strong>{match.event}</strong><div className="muted">{match.game}</div></td><td>{match.opponent}</td><td><span className={`status ${match.result === "LOSS" ? "danger" : match.result === "DRAW" ? "pending" : ""}`}>{match.result}</span></td><td><strong>{match.score}</strong></td></tr>)}</tbody></table></div></section><aside className="card panel"><h2 className="panel-title"><ShieldCheck size={17} /> Account details</h2><p className="muted">{gamer.bio}</p><div className="achievement"><span>Phone</span><strong>{gamer.phone}</strong></div><div className="achievement"><span>Ranking points</span><strong className="green">{gamer.points.toLocaleString()}</strong></div><div className="achievement"><span>Verification</span><strong>{gamer.verificationStatus}</strong></div><div className="achievement"><span>Account</span><strong><span className={`status ${isBlocked || accountStatus === "deleted" ? "danger" : accountStatus === "pending" ? "pending" : ""}`}>{accountStatus.toUpperCase()}</span></strong></div>{initialAccountStatus === null && <p className="helper">This preview profile is not connected to a database login account.</p>}</aside></div>
  </main>;
}
