import { AdminGamerEditor } from "@/components/admin-gamer-editor";
import { getGamerAccountBySlug } from "@/lib/gamer-account-access";

export const metadata = { title: "Edit Gamer" };

export default async function AdminGamerEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const account = await getGamerAccountBySlug(slug);
  return <AdminGamerEditor slug={slug} initialAccountStatus={account?.status ?? null} />;
}
