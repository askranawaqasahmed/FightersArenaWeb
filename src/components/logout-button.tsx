"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace(redirectTo);
    router.refresh();
  }

  return <button className="button button-secondary button-small" type="button" onClick={logout}><LogOut size={14} /> Sign out</button>;
}
