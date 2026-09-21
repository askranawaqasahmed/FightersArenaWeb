import { requireGamer } from "@/lib/gamer-auth";
import { DashboardAccountSettings } from "@/components/dashboard-account-settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const account = await requireGamer();
  return (
    <div className="page-shell">
      <div className="container">
        <header className="section-heading">
          <h1>Account</h1>
          <p className="muted">Change the email address and password you sign in with.</p>
        </header>
        <DashboardAccountSettings
          email={account.email}
          phone={account.phone}
          mustChangePassword={account.mustChangePassword}
        />
      </div>
    </div>
  );
}
