"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Zap } from "lucide-react";
import { Brand } from "@/components/brand";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Only authorized superadmin and admin accounts can sign in.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState<"password" | "quick" | null>(null);

  async function handleResponse(response: Response) {
    const body = await response.json();
    setLoading(null);
    if (response.ok) {
      setMessage("Authenticated. Opening the admin portal…");
      router.replace("/admin");
      router.refresh();
      return;
    }
    setError(true);
    setMessage(body.detail ?? "The email address or password is incorrect.");
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("password");
    setError(false);
    const response = await fetch("/api/v1/auth/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await handleResponse(response);
  }

  async function quickSignIn() {
    setLoading("quick");
    setError(false);
    setMessage("Opening the development superadmin session…");
    const response = await fetch("/api/v1/auth/admin/quick-login", { method: "POST" });
    await handleResponse(response);
  }

  return <main className="auth-page"><section className="card auth-card"><Brand /><h1>Admin portal.</h1><p className="muted">Sign in with an authorized administrator account.</p>{process.env.NODE_ENV !== "production" && <button className="button button-secondary admin-quick-signin" type="button" disabled={loading !== null} onClick={quickSignIn}><Zap size={16} /> {loading === "quick" ? "Opening superadmin…" : "Quick sign in as superadmin"}</button>}<form className="auth-form" onSubmit={signIn}><label className="form-group"><span className="form-label">Email address</span><input className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="form-group"><span className="form-label">Password</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-primary" disabled={loading !== null}><LockKeyhole size={16} /> {loading === "password" ? "Signing in…" : "Sign in"} {loading === null && <ArrowRight size={16} />}</button><p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p></form><Link className="text-link" href="/">Return to public site</Link></section></main>;
}
