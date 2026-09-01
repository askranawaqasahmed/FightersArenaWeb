"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Gamepad2, Image, LayoutDashboard, PanelLeftClose, PanelLeftOpen, ShieldCheck, Trophy, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { Brand } from "./brand";
import type { AdminRole } from "@/lib/auth";

const items = [
  ["Overview", "/admin", LayoutDashboard],
  ["Gamers", "/admin/gamers", Users],
  ["Teams", "/admin/teams", ShieldCheck],
  ["Events", "/admin/tournaments", Trophy],
  ["Games", "/admin/games", Gamepad2],
  ["Content", "/admin/content", Image],
  ["Reports", "/admin/reports", BarChart3],
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return <aside className={`admin-sidebar${collapsed ? " collapsed" : ""}`}><div className="admin-sidebar-header"><Brand compact={collapsed} /><button className="admin-sidebar-toggle" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div><nav className="admin-nav" aria-label="Admin navigation">{items.map(([label, href, Icon]) => {
    const isActive = isActivePath(pathname, href);
    return <Link href={href} key={href} className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}><Icon size={17} /><span>{label}</span></Link>;
  })}{role === "super_admin" && (() => {
    const href = "/admin/users";
    const isActive = isActivePath(pathname, href);
    return <Link href={href} className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}><UserCog size={17} /><span>Admin users</span></Link>;
  })()}</nav></aside>;
}
