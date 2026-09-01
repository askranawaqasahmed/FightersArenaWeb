"use client";

import { DoorClosed, DoorOpen, Megaphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventStatus = "DRAFT" | "REGISTRATION OPEN" | "READY" | "LIVE" | "COMPLETED";
type LifecycleAction = "publish" | "open_registration" | "close_registration";

export function AdminEventLifecycleControls({ tournamentId, status }: { tournamentId: string; status: EventStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<LifecycleAction | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function runAction(action: LifecycleAction) {
    setLoading(action);
    setError(false);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/admin/tournaments/${tournamentId}/lifecycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Unable to update the event.");
      setMessage(action === "publish"
        ? "Event published. Players can now see it; open registration when you are ready."
        : action === "open_registration"
          ? "Registration is open. Players can now sign up from the app and website."
          : "Registration is closed. Approve the entrants, then start the tournament.");
      router.refresh();
    } catch (actionError) {
      setError(true);
      setMessage(actionError instanceof Error ? actionError.message : "Unable to update the event.");
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;
  return (
    <div className="event-lifecycle-controls">
      <div className="header-actions">
        {status === "DRAFT" && <button className="button button-primary button-small" type="button" disabled={busy} onClick={() => runAction("publish")}><Megaphone size={15} /> {loading === "publish" ? "Publishing…" : "Publish event"}</button>}
        {status === "READY" && <button className="button button-primary button-small" type="button" disabled={busy} onClick={() => runAction("open_registration")}><DoorOpen size={15} /> {loading === "open_registration" ? "Opening…" : "Open registration"}</button>}
        {status === "REGISTRATION OPEN" && <button className="button button-secondary button-small" type="button" disabled={busy} onClick={() => runAction("close_registration")}><DoorClosed size={15} /> {loading === "close_registration" ? "Closing…" : "Close registration"}</button>}
      </div>
      {message && <p className={`form-message ${error ? "form-error" : "form-success"}`} role="status">{message}</p>}
    </div>
  );
}
