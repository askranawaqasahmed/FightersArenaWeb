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
  /** false records the event as a final result only, with no stages or matches. */
  hasBracket?: boolean;
  youtubeUrl?: string | null;
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
