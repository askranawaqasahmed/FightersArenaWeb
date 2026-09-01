import { ConnectedEliminationBracket } from "./connected-elimination-bracket";
import { generateDoubleElimination, generateSingleElimination } from "@/domain/tournament-engine";

const entrants = ["Team Cipher", "Northwind", "Riftwalkers", "Orbit", "Volt", "Aegis", "Zenith", "Ember"]
  .map((name, index) => ({ id: `team-${index + 1}`, name, seed: index + 1 }));

export function BracketView({ format }: { format: string }) {
  const doubleElimination = format.toLowerCase().includes("double");
  const bracket = doubleElimination
    ? generateDoubleElimination(entrants, { bestOf: 3, grandFinalReset: true })
    : generateSingleElimination(entrants, { bestOf: 3 });
  return <div aria-label={`${doubleElimination ? "Double" : "Single"} elimination bracket`}><ConnectedEliminationBracket bracket={bracket} /></div>;
}
