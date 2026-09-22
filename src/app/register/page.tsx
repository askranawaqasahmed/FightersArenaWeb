"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Brand } from "@/components/brand";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Create your player account to join competitions.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, email, password, ...(phone.trim() ? { phone: phone.trim() } : {}) }),
      });
      const body = await response.json();
      if (response.ok) {
        setMessage("Account created. Opening your player dashboard…");
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      setError(true);
      setMessage(body.errors?.[0]?.message ?? body.detail ?? "Registration failed.");
    } catch {
      setError(true);
      setMessage("Unable to reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="card auth-card"><Brand /><h1>Join the arena.</h1><p className="muted">Build your player profile and find your place in the community.</p><form className="auth-form" onSubmit={register}><label className="form-group"><span className="form-label">Display name</span><input className="input" autoComplete="nickname" minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label className="form-group"><span className="form-label">Email address</span><input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="form-group"><span className="form-label">Mobile number (optional)</span><input className="input" type="tel" autoComplete="tel" placeholder="03001234567" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="form-group"><span className="form-label">Password</span><input className="input" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-primary" disabled={loading}><UserPlus size={16} /> {loading ? "Creating account…" : "Create account"}</button><p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p></form><p className="muted">Already have an account? <Link className="text-link" href="/login">Sign in</Link></p><Link className="text-link" href="/">Return to public site</Link></section></main>;
}
