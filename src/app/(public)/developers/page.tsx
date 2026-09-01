import Link from "next/link";
import { ArrowUpRight, Braces, KeyRound, ShieldCheck } from "lucide-react";

const endpoints = [
  ["GET", "/api/v1/games", "Browse the active game catalog and roster rules."],
  ["GET", "/api/v1/gamers", "Search consented public gamer profiles and rankings."],
  ["GET", "/api/v1/tournaments", "Read tournament dates, registration and publication state."],
  ["POST", "/api/v1/stages/generate", "Generate round-robin or elimination stage previews."],
] as const;

export const metadata = { title: "Developer API" };

export default function DevelopersPage() {
  return <div className="page-shell"><div className="container"><div className="eyebrow">API v1 · OpenAPI 3.1</div><h1 className="page-title">Build on the<br /><span className="green">competitive graph.</span></h1><p className="lede">The same versioned REST API powers the portal and future gamer mobile application. Predictable resources, typed errors, rotating sessions and deterministic competition tools.</p><div className="hero-actions"><Link className="button button-primary" href="/api/reference" target="_blank">Open interactive reference <ArrowUpRight size={16} /></Link><a className="button button-secondary" href="/api/openapi.json"><Braces size={16} /> Download OpenAPI JSON</a></div><section className="section"><div className="stats-grid"><div className="stat"><KeyRound className="green" /><div className="stat-label">JWT access + rotating refresh sessions</div></div><div className="stat"><ShieldCheck className="blue" /><div className="stat-label">Problem Details and request identifiers</div></div><div className="stat"><Braces className="green" /><div className="stat-label">Runtime-validated JSON contracts</div></div><div className="stat"><ArrowUpRight className="blue" /><div className="stat-label">Stable `/api/v1` namespace</div></div></div></section><section><div className="eyebrow">Selected endpoints</div><h2 className="section-title">Start integrating</h2>{endpoints.map(([method, path, summary]) => <article className="card endpoint" key={path}><div><span className={`method ${method === "POST" ? "post" : ""}`}>{method}</span><code>{path}</code></div><p className="muted">{summary}</p></article>)}</section></div></div>;
}
