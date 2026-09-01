"use client";

// An OBS browser source never gets manually refreshed mid-stream, so a crashed
// overlay must degrade to an empty transparent frame instead of an error page.
export default function OverlayError() {
  return null;
}
