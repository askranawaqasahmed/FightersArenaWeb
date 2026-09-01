"use client";

import Link from "next/link";
import { BadgeCheck, Download, Eye, Pencil, Search, UserRoundSearch } from "lucide-react";
import { useState } from "react";
import { useManagedGamers } from "./managed-gamers";

export function AdminGamerDirectory() {
  const gamers = useManagedGamers();
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("all");
  const [city, setCity] = useState("all");
  const [status, setStatus] = useState("all");
  const filteredGamers = gamers.filter((gamer) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || `${gamer.handle} ${gamer.name} ${gamer.phone}`.toLowerCase().includes(search);
    return matchesSearch && (game === "all" || gamer.game === game) && (city === "all" || gamer.city === city) && (status === "all" || gamer.verificationStatus === status);
  });

  function exportDirectory() {
    const rows = [["Handle", "Name", "Phone", "City", "Game", "Rank", "Verification"], ...filteredGamers.map((gamer) => [gamer.handle, gamer.name, gamer.phone, gamer.city, gamer.game, gamer.rank, gamer.verificationStatus])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gamers.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className="admin-content">
    <div className="section-header"><div><h1 className="admin-heading">Gamers</h1><p className="admin-subtitle">Review identities, public profiles, game handles and player history.</p></div><button className="button button-primary" type="button" onClick={exportDirectory}><Download size={15} /> Export directory</button></div>
    <div className="directory-filters" aria-label="Gamer directory filters"><label className="filter-search directory-search"><Search size={17} /><input className="input" aria-label="Search gamers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, handle or phone" /></label><div className="directory-filter-row"><select className="select filter-select" aria-label="Filter gamers by game" value={game} onChange={(event) => setGame(event.target.value)}><option value="all">All games</option>{[...new Set(gamers.map((gamer) => gamer.game))].sort().map((item) => <option key={item}>{item}</option>)}</select><select className="select filter-select" aria-label="Filter gamers by city" value={city} onChange={(event) => setCity(event.target.value)}><option value="all">All cities</option>{[...new Set(gamers.map((gamer) => gamer.city))].sort().map((item) => <option key={item}>{item}</option>)}</select><select className="select filter-select" aria-label="Filter gamers by verification" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All verification</option><option value="verified">Verified</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div></div>
    <section className="card panel table-scroll"><table className="data-table"><thead><tr><th>Gamer</th><th>Location</th><th>Primary game</th><th>Rank</th><th>Status</th><th /></tr></thead><tbody>{filteredGamers.map((gamer) => <tr key={gamer.slug}><td><strong>{gamer.handle} {gamer.verificationStatus === "verified" && <BadgeCheck className="verified" size={13} />}</strong><div className="muted">{gamer.name}</div></td><td>{gamer.city}</td><td>{gamer.game}</td><td>#{gamer.rank}</td><td><span className={`status ${gamer.verificationStatus === "pending" ? "pending" : gamer.verificationStatus === "rejected" ? "danger" : ""}`}>{gamer.verificationStatus.toUpperCase()}</span></td><td><div className="header-actions"><Link className="button button-secondary button-small" href={`/admin/gamers/${gamer.slug}`} aria-label={`View ${gamer.handle}`}><Eye size={14} /> View</Link><Link className="button button-secondary button-small" href={`/admin/gamers/${gamer.slug}/edit`} aria-label={`Edit ${gamer.handle}`}><Pencil size={14} /> Edit</Link></div></td></tr>)}</tbody></table>{filteredGamers.length === 0 && <div className="account-empty compact"><UserRoundSearch className="green" /><h2>No gamers found</h2><p className="muted">Change the search or filters to find another player.</p></div>}</section>
  </main>;
}
