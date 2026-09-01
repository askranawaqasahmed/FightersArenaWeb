import Link from "next/link";
import { LayoutDashboard, Search } from "lucide-react";
import { Brand } from "./brand";

const navigation = [
  ["Games", "/games"],
  ["Gamers", "/gamers"],
  ["Tournaments", "/tournaments"],
  ["Rankings", "/gamers#rankings"],
  ["Developers", "/developers"],
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Main navigation">
          {navigation.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="header-actions">
          <button className="button button-secondary button-small" aria-label="Search"><Search size={16} /> Search</button>
          <Link className="button button-secondary button-small admin-shortcut" href="/admin"><LayoutDashboard size={15} /> Admin portal</Link>
          <Link className="button button-primary button-small join-button" href="/login">Join arena</Link>
        </div>
      </div>
    </header>
  );
}
