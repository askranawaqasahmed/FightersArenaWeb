"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

export function CreateAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Use at least 12 characters with a letter, number, and special character.");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(false);

    const response = await fetch("/api/v1/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(true);
      setMessage(body.errors?.[0]?.message ?? body.detail ?? "The admin account could not be created.");
      return;
    }

    setEmail("");
    setPassword("");
    setMessage(`Admin account created for ${body.data.email}.`);
    router.refresh();
  }

  return <form className="auth-form" onSubmit={createAdmin}><label className="form-group"><span className="form-label">Admin email</span><input className="input" type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label className="form-group"><span className="form-label">Temporary password</span><input className="input" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-primary" disabled={loading}><UserPlus size={16} /> {loading ? "Creating…" : "Create admin"}</button><p className={`helper${error ? " form-error" : ""}`} role="status">{message}</p></form>;
}
