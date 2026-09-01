import { AdminGamerDetail } from "@/components/admin-gamer-detail";
import { getGamerAccountBySlug } from "@/lib/gamer-account-access";

export const metadata = { title: "Gamer Details" };

export default async function AdminGamerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const account = await getGamerAccountBySlug(slug);
  return <AdminGamerDetail slug={slug} initialAccountStatus={account?.status ?? null} />;
}
