"use client";

import { useEffect, useState } from "react";

export type CatalogGame = {
  id: string;
  slug: string;
  name: string;
  genre: string;
  teamSize: number;
};

/**
 * The game catalogue, read from the database through the public games API.
 * Replaces the old localStorage catalogue, which was invisible to the server.
 */
export function useGameCatalog() {
  const [games, setGames] = useState<CatalogGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/games")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("Unable to load games."))))
      .then((body) => { if (!cancelled) setGames(Array.isArray(body.data) ? body.data : []); })
      .catch(() => { if (!cancelled) setGames([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  return { games, loaded };
}
