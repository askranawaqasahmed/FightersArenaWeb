"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+923001234567");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [message, setMessage] = useState("Request a six-digit verification code to continue.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);
    const response = await fetch("/api/v1/auth/otp/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone }) });
    const body = await response.json();
    setLoading(false);
    if (response.ok) {
      setChallengeId(body.data.challengeId);
      if (body.data.debugCode) {
        setCode(body.data.debugCode);
        setMessage(`Development code ${body.data.debugCode} is ready to verify.`);
      } else {
        setMessage("Code requested. Enter the six-digit verification code.");
      }
    } else {
      setError(true);
      setMessage(body.detail ?? "Unable to request a code.");
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError(false);
    const response = await fetch("/api/v1/auth/otp/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone, code, challengeId }) });
    const body = await response.json();
    setLoading(false);
    if (response.ok) {
      setMessage("Authenticated. Opening your player dashboard…");
      router.replace("/dashboard");
      router.refresh();
    } else {
      setError(true);
      setMessage(body.detail ?? "Verification failed.");
    }
  }

  return <main className="auth-page"><section className="card auth-card"><Brand /><h1>Enter the arena.</h1><p className="muted">Sign in to view your player profile and competition history.</p><form className="auth-form" onSubmit={requestCode}><label className="form-group"><span className="form-label">Mobile number</span><input className="input" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></label>{challengeId && <label className="form-group"><span className="form-label">Verification code</span><input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>}{challengeId ? <button className="button button-primary" type="button" onClick={verifyCode} disabled={loading}><LockKeyhole size={16} /> {loading ? "Verifying…" : "View my dashboard"}</button> : <button className="button button-primary" disabled={loading}>{loading ? "Requesting…" : "Request code"}<ArrowRight size={16} /></button>}<p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p></form><Link className="text-link" href="/">Return to public site</Link></section></main>;
}
