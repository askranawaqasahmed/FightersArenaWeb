import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { cities } from "@/db/schema";
import { AdminGamerCreateForm } from "@/components/admin-gamer-create-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Add Gamer" };

export default async function AdminGamerCreatePage() {
  const cityOptions = await db.select({ id: cities.id, name: cities.name }).from(cities).orderBy(asc(cities.name));
  return <AdminGamerCreateForm cityOptions={cityOptions} />;
}
