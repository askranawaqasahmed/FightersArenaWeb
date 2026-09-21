import { AdminEventDetail } from "@/components/admin-event-detail";
import { AdminPlacementEditor } from "@/components/admin-placement-editor";
import { listSelectableGamers } from "@/lib/admin-gamer-data";
import { listDivisionPlacements } from "@/lib/admin-placement-data";
import { getAdminEventFromDatabase } from "@/lib/admin-tournament-data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Event Details" };

export default async function EventDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const databaseEvent = await getAdminEventFromDatabase(slug);
  // Events without a bracket keep their results here rather than in matches.
  const recordsResults = databaseEvent !== null && databaseEvent.event.hasBracket === false;
  const [divisions, gamers] = recordsResults
    ? await Promise.all([listDivisionPlacements(slug), listSelectableGamers()])
    : [[], []];

  return (
    <>
      <AdminEventDetail
        slug={slug}
        initialEvent={databaseEvent?.event}
        lifecycleCompetitions={databaseEvent?.lifecycleCompetitions}
        databaseBacked={Boolean(databaseEvent)}
      />
      {recordsResults && (
        <div className="admin-content">
          <AdminPlacementEditor
            divisions={divisions}
            gamers={gamers.map((gamer) => ({ id: gamer.id, handle: gamer.handle, displayName: gamer.displayName }))}
          />
        </div>
      )}
    </>
  );
}
