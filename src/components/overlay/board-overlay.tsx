"use client";

import { useEffect, useRef, useState } from "react";
import type { BoardState } from "@/lib/stream-board-data";
import { MatchCard } from "@/components/overlay/match-card";
import { ProfileCard } from "@/components/overlay/profile-card";
import { ScoreBar } from "@/components/overlay/score-bar";

const POLL_INTERVAL_MS = 1000;
const FAILURES_BEFORE_WARNING = 5;

type OverlayView = "bar" | "card" | "profile";

export function BoardOverlay({
  number,
  view,
  slot,
  initialState,
}: {
  number: number;
  view: OverlayView;
  slot?: 1 | 2;
  initialState: BoardState;
}) {
  const [state, setState] = useState<BoardState>(initialState);
  const [degraded, setDegraded] = useState(false);
  const etagRef = useRef<string | null>(null);
  const failuresRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (view === "profile") {
      params.set("include", "profile");
      if (slot) params.set("slot", String(slot));
    }
    const query = params.size ? `?${params.toString()}` : "";
    let cancelled = false;

    const poll = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers["if-none-match"] = etagRef.current;
        const response = await fetch(`/api/v1/boards/${number}${query}`, { headers, cache: "no-store" });
        if (response.status === 304) {
          failuresRef.current = 0;
          if (!cancelled) setDegraded(false);
          return;
        }
        if (!response.ok) throw new Error(`Board request failed with ${response.status}`);
        const body = (await response.json()) as { data: BoardState };
        etagRef.current = response.headers.get("etag");
        failuresRef.current = 0;
        if (!cancelled) {
          setState(body.data);
          setDegraded(false);
        }
      } catch {
        failuresRef.current += 1;
        if (!cancelled && failuresRef.current >= FAILURES_BEFORE_WARNING) setDegraded(true);
      } finally {
        inFlightRef.current = false;
      }
    };

    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [number, view, slot]);

  return (
    <>
      {view === "bar" && <ScoreBar state={state} />}
      {view === "card" && <MatchCard state={state} />}
      {view === "profile" && <ProfileCard state={state} />}
      {degraded && <span className="overlay-reconnecting" title="Reconnecting" />}
    </>
  );
}
