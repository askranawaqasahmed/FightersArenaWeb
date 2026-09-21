"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Sign in with your email address or mobile number.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const body = await response.json();
      if (response.ok) {
        setMessage("Signed in. Opening your player dashboard…");
        router.replace(body.data?.mustChangePassword ? "/dashboard/settings?first=1" : "/dashboard");
        router.refresh();
        return;
      }
      setError(true);
      setMessage(body.detail ?? "Sign in failed.");
    } catch {
      setError(true);
      setMessage("Unable to reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page"><section className="card auth-card"><Brand /><h1>Enter the arena.</h1><p className="muted">Sign in to manage your player profile and competition history.</p><form className="auth-form" onSubmit={signIn}><label className="form-group"><span className="form-label">Email or mobile number</span><input className="input" type="text" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required /></label><label className="form-group"><span className="form-label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-primary" disabled={loading}><LockKeyhole size={16} /> {loading ? "Signing in…" : "Sign in"}</button><p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p></form><Link className="text-link" href="/">Return to public site</Link></section></main>;
}
