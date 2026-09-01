import type { CompetitionType, EventAttachmentDraft, GameSlug, StageFormat } from "./tournament-draft";

export type AdminParticipant = {
  id: string;
  registrationId?: string;
  handle: string;
  name: string;
  team?: string;
  isLeader?: boolean;
  registrationStatus: "confirmed" | "pending" | "declined";
  paymentStatus: "received" | "pending" | "not_required";
  accountStatus: "active" | "pending" | "inactive";
};

export type AdminEventCompetition = {
  id: string;
  tournamentId?: string;
  name: string;
  gameSlug: GameSlug;
  game: string;
  type: CompetitionType;
  status: "DRAFT" | "REGISTRATION OPEN" | "PENDING CONFIRMATION" | "READY" | "LIVE" | "COMPLETED";
  capacity: number;
  registrationRestricted?: boolean;
  registrationLimit?: number;
  teamCount?: number;
  playersPerTeam?: number;
  stages: StageFormat[];
  participants: AdminParticipant[];
};

export type EventGalleryImage = {
  id?: string;
  key: string;
  url: string;
  name: string;
  altText: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type AdminEvent = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
  attachments?: EventAttachmentDraft[];
  galleryImages?: EventGalleryImage[];
  date: string;
  startsAt: string;
  endsAt: string;
  createdAt?: string;
  location: string;
  status: "DRAFT" | "REGISTRATION OPEN" | "READY" | "LIVE" | "COMPLETED";
  competitions: AdminEventCompetition[];
};

export type AdminLifecycleCompetition = {
  tournamentId: string;
  divisionId: string;
  name: string;
  game: string;
  status: "DRAFT" | "REGISTRATION OPEN" | "READY" | "LIVE" | "COMPLETED";
  actualParticipants: number;
  totalMatches: number;
  unfinishedMatches: number;
};

export const adminEvents: AdminEvent[] = [
  {
    slug: "national-esports-championship-2026",
    name: "National Esports Championship 2026",
    description: "A single national event containing independent Dota 2 and VALORANT competitions.",
    date: "Aug 18–24, 2026",
    startsAt: "2026-08-18",
    endsAt: "2026-08-24",
    location: "Karachi Expo Centre",
    status: "REGISTRATION OPEN",
    competitions: [
      {
        id: "nec-dota-open",
        name: "Dota 2 National Open",
        gameSlug: "dota-2",
        game: "Dota 2",
        type: "tournament",
        status: "REGISTRATION OPEN",
        capacity: 32,
        stages: ["groups", "double-elimination"],
        participants: [
          { id: "nova", handle: "NOVA", name: "Ayaan Khan", registrationStatus: "confirmed", paymentStatus: "received", accountStatus: "active" },
          { id: "viper", handle: "VIPER", name: "Hassan Raza", registrationStatus: "confirmed", paymentStatus: "pending", accountStatus: "active" },
          { id: "raven", handle: "RAVEN", name: "Sara Malik", registrationStatus: "pending", paymentStatus: "pending", accountStatus: "active" },
          { id: "frost", handle: "FROST", name: "Ali Noor", registrationStatus: "confirmed", paymentStatus: "received", accountStatus: "active" },
        ],
      },
      {
        id: "nec-valorant-league",
        name: "VALORANT City League",
        gameSlug: "valorant",
        game: "VALORANT",
        type: "league",
        status: "PENDING CONFIRMATION",
        capacity: 20,
        teamCount: 4,
        playersPerTeam: 5,
        stages: ["groups", "single-elimination"],
        participants: [
          { id: "cipher", handle: "CIPHER", name: "Hamza Ahmed", team: "Team Cipher", isLeader: true, registrationStatus: "confirmed", paymentStatus: "not_required", accountStatus: "active" },
          { id: "volt", handle: "VOLT", name: "Zain Shah", team: "Team Cipher", registrationStatus: "pending", paymentStatus: "not_required", accountStatus: "active" },
          { id: "aegis", handle: "AEGIS", name: "Mariam Iqbal", team: "Northwind", isLeader: true, registrationStatus: "confirmed", paymentStatus: "not_required", accountStatus: "active" },
          { id: "orbit", handle: "ORBIT", name: "Usman Tariq", team: "Northwind", registrationStatus: "pending", paymentStatus: "not_required", accountStatus: "active" },
        ],
      },
    ],
  },
  {
    slug: "iron-fist-weekend-2026",
    name: "Iron Fist Weekend 2026",
    description: "A focused Tekken 8 event with one open tournament.",
    date: "Sep 20, 2026",
    startsAt: "2026-09-20",
    endsAt: "2026-09-20",
    location: "Lahore Gaming Arena",
    status: "DRAFT",
    competitions: [{
      id: "iron-fist-open",
      name: "Tekken 8 Open",
      gameSlug: "tekken-8",
      game: "Tekken 8",
      type: "tournament",
      status: "DRAFT",
      capacity: 64,
      stages: ["double-elimination"],
      participants: [],
    }],
  },
];
