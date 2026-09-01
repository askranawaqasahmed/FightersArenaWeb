import { apiData } from "@/lib/api";

const teams = [
  { id: "team-cipher", slug: "team-cipher", name: "Team Cipher", tag: "CIP", city: "Karachi", verified: true, activeRosterSize: 5 },
  { id: "northwind", slug: "northwind", name: "Northwind", tag: "NTW", city: "Lahore", verified: true, activeRosterSize: 7 },
  { id: "riftwalkers", slug: "riftwalkers", name: "Riftwalkers", tag: "RFT", city: "Islamabad", verified: false, activeRosterSize: 5 },
];

export function GET() { return apiData(teams); }
