"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, UserRoundX } from "lucide-react";
import { useState } from "react";
import { useManagedGames } from "./managed-game-directory";
import { persistManagedGamers, useManagedGamers, type ManagedGamer } from "./managed-gamers";
import type { GamerAccountStatus } from "@/lib/gamer-account-access";

export function AdminGamerEditor({ slug, initialAccountStatus = null }: { slug: string; initialAccountStatus?: GamerAccountStatus | null }) {
  const router = useRouter();
  const gamers = useManagedGamers();
  const original = gamers.find((item) => item.slug === slug);
  const games = useManagedGames().filter((game) => game.active);
  const [formOverride, setFormOverride] = useState<ManagedGamer>();
  const databaseManagedStatus = initialAccountStatus === "suspended" ? "suspended" as const : "active" as const;
  const form = formOverride ?? (original ? { ...original, accountStatus: initialAccountStatus === null ? original.accountStatus : databaseManagedStatus } : undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!original || !form) return <main className="admin-content"><div className="account-empty card"><UserRoundX className="green" /><h1>Gamer not found</h1><p className="muted">This gamer cannot be edited because it does not exist.</p><Link className="button button-secondary" href="/admin/gamers">Back to gamers</Link></div></main>;
  const currentGamer = original;
  const currentForm = form;

  function update(changes: Partial<ManagedGamer>) {
    setFormOverride((current) => ({ ...(current ?? currentGamer), ...changes }));
    setError("");
  }

  async function save() {
    if (!currentForm.name.trim() || !currentForm.handle.trim() || !currentForm.city.trim() || !currentForm.phone.trim()) { setError("Name, handle, city, and phone are required."); return; }
    const accountStatusChanged = currentForm.accountStatus !== (initialAccountStatus === null ? currentGamer.accountStatus : databaseManagedStatus);
    if (accountStatusChanged && initialAccountStatus === null) {
      setError("This preview profile is not connected to a database login account and cannot be blocked.");
      return;
    }
    if (currentForm.accountStatus === "suspended" && accountStatusChanged && !window.confirm(`Block ${currentGamer.handle}? Every active gamer session will be signed out.`)) return;
    setSaving(true);
    setError("");
    if (accountStatusChanged) {
      try {
        const response = await fetch(`/api/v1/admin/gamers/${encodeURIComponent(slug)}/status`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: currentForm.accountStatus }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail ?? "The gamer account status could not be changed.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "The gamer account status could not be changed.");
        setSaving(false);
        return;
      }
    }
    const saved = { ...currentForm, handle: currentForm.handle.trim().toUpperCase(), initials: currentForm.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() };
    persistManagedGamers(gamers.map((gamer) => gamer.slug === slug ? saved : gamer));
    router.replace(`/admin/gamers/${slug}`);
  }

  return <main className="admin-content admin-editor-content">
    <Link className="text-link" href={`/admin/gamers/${slug}`}><ArrowLeft size={14} /> Gamer details</Link>
    <div className="section-header" style={{ marginTop: 18 }}><div><h1 className="admin-heading">Edit {original.handle}</h1><p className="admin-subtitle">Update identity, competition profile, verification, and account access.</p></div><button className="button button-primary" type="button" disabled={saving} onClick={save}><Save size={15} /> {saving ? "Saving…" : "Save gamer"}</button></div>
    {error && <p className="form-message form-error" role="alert">{error}</p>}
    <section className="card panel entity-editor"><h2 className="panel-title">Profile identity</h2><div className="builder-grid"><label className="form-group"><span className="form-label">Full name</span><input className="input" value={form.name} onChange={(event) => update({ name: event.target.value })} /></label><label className="form-group"><span className="form-label">Gamer handle</span><input className="input" value={form.handle} onChange={(event) => update({ handle: event.target.value })} /></label><label className="form-group"><span className="form-label">Phone</span><input className="input" value={form.phone} onChange={(event) => update({ phone: event.target.value })} /></label><label className="form-group"><span className="form-label">City</span><input className="input" value={form.city} onChange={(event) => update({ city: event.target.value })} /></label><label className="form-group"><span className="form-label">Primary game</span><select className="select" value={form.game} onChange={(event) => update({ game: event.target.value })}>{games.map((game) => <option value={game.name} key={game.slug}>{game.name} · {game.genre}</option>)}</select></label><label className="form-group"><span className="form-label">Ranking points</span><input className="input" type="number" min="0" value={form.points} onChange={(event) => update({ points: Number(event.target.value) })} /></label><label className="form-group"><span className="form-label">Verification</span><select className="select" value={form.verificationStatus} onChange={(event) => update({ verificationStatus: event.target.value as ManagedGamer["verificationStatus"] })}><option value="verified">Verified</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></label><label className="form-group"><span className="form-label">Account status</span><select className="select" value={form.accountStatus} onChange={(event) => update({ accountStatus: event.target.value as ManagedGamer["accountStatus"] })}><option value="active">Active</option><option value="suspended">Suspended</option></select><span className="helper">Blocking revokes every active session. Unblocking requires the gamer to sign in again.</span></label></div><label className="form-group" style={{ marginTop: 18 }}><span className="form-label">Biography</span><textarea className="textarea" value={form.bio} onChange={(event) => update({ bio: event.target.value })} /></label></section>
  </main>;
}
