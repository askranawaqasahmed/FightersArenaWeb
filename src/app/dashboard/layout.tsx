import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import { requireGamer } from "@/lib/gamer-auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const account = await requireGamer();
  return <div className="account-shell"><header className="account-header"><div className="container account-header-inner"><Brand /><div className="header-actions"><span className="admin-identity">{account.phone}</span><Link className="button button-secondary button-small" href="/gamers">Player rankings <ExternalLink size={13} /></Link><LogoutButton /></div></div></header>{children}</div>;
}
