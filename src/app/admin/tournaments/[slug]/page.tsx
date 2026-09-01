import { AdminEventDetail } from "@/components/admin-event-detail";
import { adminEvents } from "@/lib/admin-events";
import { getAdminEventFromDatabase } from "@/lib/admin-tournament-data";

export const metadata = { title: "Event Details" };

export default async function EventDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const databaseEvent = await getAdminEventFromDatabase(slug);
  return <AdminEventDetail slug={slug} initialEvent={databaseEvent?.event ?? adminEvents.find((event) => event.slug === slug)} lifecycleCompetitions={databaseEvent?.lifecycleCompetitions} databaseBacked={Boolean(databaseEvent)} />;
}
