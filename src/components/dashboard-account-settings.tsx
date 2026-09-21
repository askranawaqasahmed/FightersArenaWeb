"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, KeyRound } from "lucide-react";

type Props = {
  email: string | null;
  phone: string | null;
  mustChangePassword: boolean;
};

export function DashboardAccountSettings({ email, phone, mustChangePassword }: Props) {
  const router = useRouter();

  const [nextEmail, setNextEmail] = useState(email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMessage, setEmailMessage] = useState("Your email address is also your sign-in name.");
  const [emailError, setEmailError] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState(
    mustChangePassword
      ? "Choose your own password to finish setting up your account."
      : "Use at least 8 characters.",
  );
  const [passwordError, setPasswordError] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailLoading(true);
    setEmailError(false);
    try {
      const response = await fetch("/api/v1/me/email", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: nextEmail, currentPassword: emailPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setEmailError(true);
        setEmailMessage(body.errors?.[0]?.message ?? body.detail ?? "The email address could not be changed.");
        return;
      }
      setEmailPassword("");
      setEmailMessage(`Sign in with ${body.data.email} from now on.`);
      router.refresh();
    } finally {
      setEmailLoading(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordMessage("The two new passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError(false);
    try {
      const response = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setPasswordError(true);
        setPasswordMessage(body.errors?.[0]?.message ?? body.detail ?? "The password could not be changed.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(
        body.data.revokedSessions > 0
          ? "Password updated. You have been signed out on your other devices."
          : "Password updated.",
      );
      router.refresh();
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="profile-grid">
      <section className="card panel">
        <h2 className="panel-title"><KeyRound size={17} /> Password</h2>
        {mustChangePassword && (
          <p className="helper form-error" role="status">
            You are still using the password you were given. Set your own to continue.
          </p>
        )}
        <form className="auth-form" onSubmit={submitPassword}>
          <label className="form-group">
            <span className="form-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label className="form-group">
            <span className="form-label">New password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
          </label>
          <label className="form-group">
            <span className="form-label">Confirm new password</span>
            <input className="input" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
          </label>
          <button className="button button-primary" disabled={passwordLoading}>{passwordLoading ? "Saving…" : "Change password"}</button>
          <p className={`helper${passwordError ? " form-error" : ""}`} role="status">{passwordMessage}</p>
        </form>
      </section>

      <section className="card panel">
        <h2 className="panel-title"><AtSign size={17} /> Email address</h2>
        <div className="achievement"><span>Current email</span><strong>{email ?? "Not set"}</strong></div>
        {phone && <div className="achievement"><span>Mobile</span><strong>{phone}</strong></div>}
        <form className="auth-form" onSubmit={submitEmail}>
          <label className="form-group">
            <span className="form-label">New email address</span>
            <input className="input" type="email" autoComplete="email" value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} required />
          </label>
          <label className="form-group">
            <span className="form-label">Current password</span>
            <input className="input" type="password" autoComplete="current-password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} required />
          </label>
          <button className="button button-secondary" disabled={emailLoading}>{emailLoading ? "Saving…" : "Change email"}</button>
          <p className={`helper${emailError ? " form-error" : ""}`} role="status">{emailMessage}</p>
        </form>
      </section>
    </div>
  );
}
