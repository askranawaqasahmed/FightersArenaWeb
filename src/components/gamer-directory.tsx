"use client";

import Link from "next/link";
import { BadgeCheck, MapPin, Search, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { PublicGamerSummary } from "@/lib/public-gamer-data";

export function GamerDirectory({ gamers }: { gamers: PublicGamerSummary[] }) {
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [city, setCity] = useState("all");
  const [verification, setVerification] = useState("all");

  const filteredGamers = gamers.filter((gamer) => {
    const search = query.trim().toLowerCase();
    return (!search || `${gamer.name} ${gamer.handle}`.toLowerCase().includes(search))
      && (game === "all" || gamer.game === game)
      && (city === "all" || gamer.city === city)
      && (verification === "all" || (verification === "verified" ? gamer.verified : !gamer.verified));
  });

  const gameOptions = [...new Set(gamers.map((gamer) => gamer.game).filter((value): value is string => Boolean(value)))].sort();
  const cityOptions = [...new Set(gamers.map((gamer) => gamer.city).filter((value): value is string => Boolean(value)))].sort();

  if (gamers.length === 0) {
    return (
      <div className="card account-empty">
        <h2>No public player profiles yet</h2>
        <p className="muted">Players appear here once an administrator creates their profile and marks it public.</p>
      </div>
    );
  }

  return (
    <>
      <div className="directory-filters" aria-label="Gamer ranking filters">
        <label className="filter-search directory-search">
          <Search size={17} />
          <input className="input" aria-label="Search gamers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search gamer or handle" />
        </label>
        <div className="directory-filter-row">
          <select className="select filter-select" aria-label="Filter rankings by game" value={game} onChange={(event) => setGame(event.target.value)}>
            <option value="all">All games</option>
            {gameOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="select filter-select" aria-label="Filter rankings by city" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="all">All cities</option>
            {cityOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="select filter-select" aria-label="Filter rankings by verification" value={verification} onChange={(event) => setVerification(event.target.value)}>
            <option value="all">All verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>
      {filteredGamers.length > 0 ? (
        <div className="leaderboard">
          {filteredGamers.map((gamer) => (
            <Link className="card gamer-card" href={`/gamers/${gamer.slug}`} key={gamer.slug}>
              <div className="gamer-rank">#{gamer.rank}</div>
              {gamer.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element -- operator-uploaded avatar from our own media route
                ? <img className="avatar avatar-image" src={gamer.avatarUrl} alt={gamer.name} />
                : <div className="avatar">{gamer.initials}</div>}
              <div className="gamer-handle">{gamer.handle} {gamer.verified && <BadgeCheck className="verified" size={16} />}</div>
              <div className="gamer-name">{gamer.name}</div>
              <div className="gamer-meta">
                <span>{gamer.city ? <><MapPin size={11} /> {gamer.city}</> : gamer.game ?? ""}</span>
                <strong className="green"><TrendingUp size={11} /> {gamer.points.toLocaleString()}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card account-empty compact">
          <h2>No gamers found</h2>
          <p className="muted">Try another search, game, or city.</p>
        </div>
      )}
    </>
  );
}
