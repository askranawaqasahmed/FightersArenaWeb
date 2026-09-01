"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) await navigator.share({ title, url: window.location.href });
    else await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <button className="button button-secondary button-small" type="button" onClick={share}>{copied ? <Check size={14} /> : <Share2 size={14} />}{copied ? "Link copied" : "Share"}</button>;
}
