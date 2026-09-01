"use client";

import { Camera, Clock3, Image as ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EventGalleryImage } from "@/lib/admin-events";
import { MediaUploadField } from "./media-upload-field";

export function hasEventEnded(endsAt: string, status: string, now = new Date()) {
  if (status === "COMPLETED") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) return false;
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
  return endsAt < today;
}

type EventImageGalleryProps = {
  eventSlug: string;
  eventName: string;
  endsAt: string;
  status: string;
  tournamentId?: string;
  initialImages?: EventGalleryImage[];
};

export function EventImageGallery({ eventName, endsAt, status, tournamentId, initialImages = [] }: EventImageGalleryProps) {
  const router = useRouter();
  const [altText, setAltText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canUpload = hasEventEnded(endsAt, status) && Boolean(tournamentId);
  const images = initialImages;

  async function addImage(media: { key: string; url: string; originalName: string; mimeType: string; sizeBytes: number }) {
    if (!tournamentId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/tournaments/${tournamentId}/gallery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: media.key, caption: altText.trim() || media.originalName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "The image was uploaded but could not be added to the gallery.");
      setAltText("");
      router.refresh();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "The image could not be added to the gallery.");
    } finally {
      setBusy(false);
    }
  }

  async function removeImage(image: EventGalleryImage) {
    if (!tournamentId || !image.id) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/tournaments/${tournamentId}/gallery/${image.id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? "The image could not be removed.");
      }
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "The image could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card panel event-gallery-panel" aria-labelledby="event-gallery-heading">
      <div className="section-header">
        <div><div className="eyebrow">Post-event media</div><h2 className="panel-title" id="event-gallery-heading">Event image gallery</h2><p className="helper">Upload photographs from {eventName} after the event has finished.</p></div>
        <ImageIcon className="green" size={22} />
      </div>

      {canUpload ? <div className="event-gallery-uploader">
        <label className="form-group"><span className="form-label">Image description</span><input className="input" value={altText} onChange={(event) => { setAltText(event.target.value); setError(""); }} placeholder="Describe the people and action in this image" /></label>
        <MediaUploadField purpose="event-gallery" label="Upload event image" accept="image/png,image/jpeg,image/webp,image/gif" altText={altText.trim()} disabled={!altText.trim() || busy} onUploaded={addImage} onError={setError} />
        {!altText.trim() && <p className="helper">Add an image description before choosing a file.</p>}
        {error && <p className="form-message form-error" role="alert">{error}</p>}
      </div> : <div className="event-gallery-locked"><Clock3 size={18} /><div><strong>Uploader opens after the event ends</strong><p className="helper">This event is scheduled through {endsAt || "an unset end date"}. Event photos cannot be added while it is still active.</p></div></div>}

      {images.length > 0 ? <div className="event-gallery-grid">{images.map((image) => <figure key={image.key}><div className="event-gallery-image" role="img" aria-label={image.altText} style={{ backgroundImage: `url("${image.url}")` }} /><figcaption><strong>{image.name}</strong><span>{image.altText}</span>{canUpload && image.id && <button className="button button-secondary button-small" type="button" disabled={busy} aria-label={`Remove ${image.name}`} onClick={() => removeImage(image)}><Trash2 size={13} /> Remove</button>}</figcaption></figure>)}</div> : <div className="event-gallery-empty"><Camera size={18} /><span>No post-event images uploaded yet.</span></div>}
    </section>
  );
}
