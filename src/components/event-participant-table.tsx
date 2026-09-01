"use client";

import { CheckCircle2, UserCheck, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminEventCompetition } from "@/lib/admin-events";

export function EventParticipantTable({ competition }: { eventSlug?: string; competition: AdminEventCompetition }) {
  const router = useRouter();
  const [busyRegistrationId, setBusyRegistrationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const participants = competition.participants;
  const confirmedCount = participants.filter((participant) => participant.registrationStatus === "confirmed").length;
  const pendingConfirmation = participants.filter((participant) => participant.registrationStatus === "pending").length;
  const reviewable = Boolean(competition.tournamentId) && !["LIVE", "COMPLETED"].includes(competition.status);

  async function review(registrationId: string, action: "approve" | "reject") {
    setBusyRegistrationId(registrationId);
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/tournaments/${competition.tournamentId}/divisions/${competition.id}/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? `Unable to ${action} this registration.`);
      setMessage(action === "approve"
        ? "Registration approved. The player is confirmed, eligible, and checked in."
        : "Registration rejected. The player will not enter the bracket.");
      router.refresh();
    } catch (reviewError) {
      setError(true);
      setMessage(reviewError instanceof Error ? reviewError.message : `Unable to ${action} this registration.`);
    } finally {
      setBusyRegistrationId(null);
    }
  }

  return (
    <>
      <div className="competition-status-grid">
        <div className="stat"><div className="stat-value">{participants.length}/{competition.capacity}</div><div className="stat-label">Registered or assigned</div></div>
        <div className="stat"><div className="stat-value">{confirmedCount}/{participants.length}</div><div className="stat-label">Approved entrants</div></div>
        <div className="stat"><div className="stat-value">{pendingConfirmation}</div><div className="stat-label">Awaiting approval</div></div>
      </div>
      {message && <p className={`form-message ${error ? "form-error" : "form-success"}`} role="status">{message}</p>}
      {participants.length === 0 ? <div className="account-empty compact"><UserCheck className="green" /><h3>No participants yet</h3><p className="muted">Participants will appear here after mobile registration or superadmin league assignment.</p></div> : <div className="table-scroll"><table className="data-table participant-status-table"><thead><tr><th>Player</th><th>Team / role</th><th>Confirmation</th><th>Account</th><th>Action</th></tr></thead><tbody>{participants.map((participant) => <tr key={participant.registrationId ?? participant.id}><td><strong>{participant.handle}</strong><div className="muted">{participant.name}</div></td><td>{participant.team ?? "Individual entry"}{participant.isLeader && <div className="green">Team leader</div>}</td><td><span className={`status ${participant.registrationStatus === "pending" ? "pending" : participant.registrationStatus === "declined" ? "danger" : ""}`}>{participant.registrationStatus.toUpperCase()}</span></td><td><span className={`status ${participant.accountStatus !== "active" ? "pending" : ""}`}>{participant.accountStatus.toUpperCase()}</span></td><td>{reviewable && participant.registrationId && participant.registrationStatus !== "declined" && <div className="header-actions">{participant.registrationStatus !== "confirmed" && <button className="button button-primary button-small" type="button" disabled={busyRegistrationId !== null} onClick={() => review(participant.registrationId as string, "approve")}><CheckCircle2 size={14} /> {busyRegistrationId === participant.registrationId ? "Saving…" : "Approve"}</button>}<button className="button button-secondary button-small" type="button" disabled={busyRegistrationId !== null} onClick={() => review(participant.registrationId as string, "reject")}><XCircle size={14} /> Reject</button></div>}</td></tr>)}</tbody></table></div>}
    </>
  );
}
