"use client";

import { useMemo, useSyncExternalStore } from "react";
import { featuredGamers } from "@/lib/demo-data";

export type GamerMatchHistory = {
  id: string;
  event: string;
  game: string;
  opponent: string;
  result: "WIN" | "LOSS" | "DRAW";
  score: string;
  playedAt: string;
};

export type ManagedGamer = {
  slug: string;
  handle: string;
  name: string;
  city: string;
  game: string;
  rank: number;
  points: number;
  initials: string;
  phone: string;
  bio: string;
  verificationStatus: "verified" | "pending" | "rejected";
  accountStatus: "active" | "suspended";
  matchHistory: GamerMatchHistory[];
};

export const gamerDirectoryStorageKey = "fighters-arena:admin-gamers";
export const gamerDirectoryChangeEvent = "fighters-arena:admin-gamers-changed";

export const defaultManagedGamers: ManagedGamer[] = featuredGamers.map((gamer, index) => ({
  ...gamer,
  phone: `+92300${String(1234567 + index).padStart(7, "0")}`,
  bio: `${gamer.game} competitor from ${gamer.city}, building a verified national competitive record.`,
  verificationStatus: index === 3 ? "pending" : "verified",
  accountStatus: "active",
  matchHistory: [
    { id: `${gamer.slug}-m1`, event: "National Championship 2026", game: gamer.game, opponent: index % 2 === 0 ? "VOLT" : "AEGIS", result: "WIN", score: index % 2 === 0 ? "2–0" : "2–1", playedAt: "2026-08-18" },
    { id: `${gamer.slug}-m2`, event: "City Masters Spring", game: gamer.game, opponent: index % 2 === 0 ? "RAVEN" : "NOVA", result: index === 2 ? "WIN" : "LOSS", score: index === 2 ? "3–2" : "1–2", playedAt: "2026-05-12" },
  ],
}));

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(gamerDirectoryChangeEvent, onStoreChange);
  return () => { window.removeEventListener("storage", onStoreChange); window.removeEventListener(gamerDirectoryChangeEvent, onStoreChange); };
}

function getSnapshot() {
  return window.localStorage.getItem(gamerDirectoryStorageKey) ?? "";
}

export function readManagedGamers() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(gamerDirectoryStorageKey) ?? "null") as ManagedGamer[] | null;
    return Array.isArray(stored) ? stored : defaultManagedGamers;
  } catch {
    return defaultManagedGamers;
  }
}

export function persistManagedGamers(gamers: ManagedGamer[]) {
  window.localStorage.setItem(gamerDirectoryStorageKey, JSON.stringify(gamers));
  window.dispatchEvent(new Event(gamerDirectoryChangeEvent));
}

export function useManagedGamers() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    if (!snapshot) return defaultManagedGamers;
    try { const parsed = JSON.parse(snapshot) as ManagedGamer[]; return Array.isArray(parsed) ? parsed : defaultManagedGamers; } catch { return defaultManagedGamers; }
  }, [snapshot]);
}
