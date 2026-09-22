"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";

const navigation = [["Discover", "/"], ["Games", "/games"], ["Tournaments", "/tournaments"], ["Players", "/gamers"]];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="container header-inner">
      <Brand />
      <nav className={`site-nav${open ? " is-open" : ""}`} id="main-navigation" aria-label="Main navigation">
        {navigation.map(([label, href]) => <Link onClick={() => setOpen(false)} aria-current={(href === "/" ? pathname === href : pathname.startsWith(href)) ? "page" : undefined} key={href} href={href}>{label}</Link>)}
      </nav>
      <div className="header-actions">
        <Link className="header-login" href="/login">Log in</Link>
        <Link className="button button-primary button-small join-button" href="/login">Join the arena <ArrowUpRight size={15} /></Link>
        <button className="mobile-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
    </div>
  </header>;
}
