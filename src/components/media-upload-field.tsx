"use client";

import { CheckCircle2, LoaderCircle, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import type { MediaPurpose } from "@/lib/object-storage";

export type UploadedMedia = {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

type MediaUploadFieldProps = {
  purpose: MediaPurpose;
  label: string;
  accept?: string;
  altText?: string;
  disabled?: boolean;
  onUploaded: (media: UploadedMedia) => void;
  onError?: (message: string) => void;
};

export function MediaUploadField({ purpose, label, accept, altText, disabled = false, onUploaded, onError }: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "uploaded">("idle");
  const [message, setMessage] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setState("uploading");
    setMessage(`Uploading ${file.name}…`);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("purpose", purpose);
    if (altText) formData.set("altText", altText);

    try {
      const response = await fetch("/api/v1/uploads", { method: "POST", body: formData });
      const payload = await response.json() as { data?: UploadedMedia; detail?: string };
      if (!response.ok || !payload.data) throw new Error(payload.detail || "Upload failed.");
      setState("uploaded");
      setMessage(`${file.name} uploaded to object storage.`);
      onUploaded(payload.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed.";
      setState("idle");
      setMessage(errorMessage);
      onError?.(errorMessage);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <label className="form-group media-upload-field">
      <span className="form-label">{label}</span>
      <span className={`media-upload-control${disabled ? " disabled" : ""}`}>
        {state === "uploading" ? <LoaderCircle className="upload-spinner" size={18} /> : state === "uploaded" ? <CheckCircle2 className="green" size={18} /> : <UploadCloud size={18} />}
        <span>{state === "uploading" ? "Uploading…" : "Choose file"}</span>
        <input ref={inputRef} type="file" accept={accept} disabled={disabled || state === "uploading"} onChange={(event) => void upload(event.target.files?.[0])} />
      </span>
      {message && <span className={`helper${state === "idle" ? " form-error" : ""}`} role="status">{message}</span>}
    </label>
  );
}
