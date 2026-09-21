"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserRoundPlus } from "lucide-react";
import { loginEmailForHandle } from "@/lib/slug";

type Option = { id: string; name: string };

export function AdminGamerCreateForm({ cityOptions }: { cityOptions: Option[] }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cityId, setCityId] = useState("");
  const [message, setMessage] = useState("A login is created automatically with the password 123456.");
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Shown as a placeholder so the operator can see the address before saving.
  const suggestedEmail = handle.trim() ? loginEmailForHandle(handle) : "gamertag@fightersarena.com";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/v1/admin/gamers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          handle: handle.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(cityId ? { cityId } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(true);
        setMessage(body.errors?.[0]?.message ?? body.detail ?? "The gamer could not be created.");
        return;
      }
      router.push(`/admin/gamers/${body.data.slug}/edit`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return <main className="admin-content admin-editor-content">
    <Link className="text-link" href="/admin/gamers"><ArrowLeft size={14} /> Gamers</Link>
    <div className="section-header" style={{ marginTop: 18 }}>
      <div><h1 className="admin-heading">Add gamer</h1><p className="admin-subtitle">Creates the player profile and the login they use to manage it.</p></div>
    </div>
    <section className="card panel entity-editor">
      <form className="auth-form" onSubmit={submit}>
        <div className="builder-grid">
          <label className="form-group"><span className="form-label">Display name</span><input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={100} required /></label>
          <label className="form-group"><span className="form-label">Gamer tag</span><input className="input" value={handle} onChange={(event) => setHandle(event.target.value)} minLength={2} maxLength={80} required /></label>
          <label className="form-group"><span className="form-label">Sign-in email</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={suggestedEmail} /><span className="helper">Leave blank to use {suggestedEmail}.</span></label>
          <label className="form-group"><span className="form-label">Mobile (optional)</span><input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="03001234567" /></label>
          <label className="form-group"><span className="form-label">City (optional)</span><select className="select" value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">Not set</option>{cityOptions.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
        </div>
        <button className="button button-primary" disabled={saving}><UserRoundPlus size={16} /> {saving ? "Creating…" : "Create gamer"}</button>
        <p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p>
      </form>
    </section>
  </main>;
}
