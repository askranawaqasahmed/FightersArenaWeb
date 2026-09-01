import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAdmin();
  const initials = account.email.slice(0, 2).toUpperCase();

  return <div className="admin-layout"><AdminSidebar role={account.role} /><div className="admin-main"><header className="admin-topbar"><div><span className="status">{account.role === "super_admin" ? "SUPERADMIN" : "ADMIN"}</span></div><div className="header-actions"><span className="admin-identity">{account.email}</span><Link className="button button-secondary button-small" href="/" target="_blank">View site <ExternalLink size={13} /></Link><LogoutButton redirectTo="/admin-login" /><div className="avatar" style={{ width: 36, height: 36, margin: 0, fontSize: 12 }}>{initials}</div></div></header>{children}</div></div>;
}
