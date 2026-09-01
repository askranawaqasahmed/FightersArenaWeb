import { TournamentBuilder } from "@/components/tournament-builder";
import { defaultTournamentDraft } from "@/lib/tournament-draft";

export const metadata = { title: "Create Competition" };

export default function TournamentBuilderPage() {
  return <TournamentBuilder initialDraft={defaultTournamentDraft} />;
}
