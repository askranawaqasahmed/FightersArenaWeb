import { apiData } from "@/lib/api";

const sponsors = [
  { id: "vertex", slug: "vertex", name: "Vertex", category: "Technology", verified: true, publicPartnerships: 18 },
  { id: "pulse-energy", slug: "pulse-energy", name: "Pulse Energy", category: "Beverage", verified: true, publicPartnerships: 12 },
  { id: "nexus-gear", slug: "nexus-gear", name: "Nexus Gear", category: "Gaming Hardware", verified: true, publicPartnerships: 9 },
];

export function GET() { return apiData(sponsors); }
