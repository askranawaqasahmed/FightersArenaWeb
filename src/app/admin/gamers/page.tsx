import { listAdminGamers } from "@/lib/admin-gamer-data";
import { AdminGamerDirectory } from "@/components/admin-gamer-directory";

export const dynamic = "force-dynamic";

export const metadata = { title: "Manage Gamers" };

export default async function AdminGamersPage() {
  return <AdminGamerDirectory gamers={await listAdminGamers()} />;
}
