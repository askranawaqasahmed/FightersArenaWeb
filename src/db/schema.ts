import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const accountStatus = pgEnum("account_status", ["pending", "active", "suspended", "deleted"]);
export const verificationStatus = pgEnum("verification_status", ["unverified", "pending", "verified", "rejected"]);
export const visibility = pgEnum("visibility", ["private", "sponsors", "public"]);
export const membershipStatus = pgEnum("membership_status", ["invited", "active", "inactive", "removed"]);
export const sponsorshipStatus = pgEnum("sponsorship_status", ["proposed", "accepted", "active", "ended", "declined", "revoked"]);
export const tournamentStatus = pgEnum("tournament_status", ["draft", "published", "registration_open", "registration_closed", "live", "completed", "cancelled", "archived"]);
export const stageStatus = pgEnum("stage_status", ["draft", "seeded", "locked", "live", "completed", "cancelled"]);
export const stageFormat = pgEnum("stage_format", ["round_robin", "single_elimination", "double_elimination", "custom"]);
export const participantType = pgEnum("participant_type", ["gamer", "team"]);
export const registrationStatus = pgEnum("registration_status", ["registered", "confirmed", "withdrawn", "rejected"]);
export const matchStatus = pgEnum("match_status", ["scheduled", "ready", "live", "paused", "reported", "confirmed", "final", "disputed", "forfeit", "cancelled"]);
export const competitionType = pgEnum("competition_type", ["tournament", "league"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: accountStatus("status").default("pending").notNull(),
  preferredLocale: varchar("preferred_locale", { length: 16 }).default("en").notNull(),
  acceptedTermsVersion: varchar("accepted_terms_version", { length: 32 }),
  ...timestamps,
});

export const userIdentities = pgTable("user_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: varchar("type", { length: 24 }).notNull(),
  normalizedValue: varchar("normalized_value", { length: 255 }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("user_identity_value_unique").on(table.type, table.normalizedValue)]);

export const authChallenges = pgTable("auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  identity: varchar("identity", { length: 255 }).notNull(),
  purpose: varchar("purpose", { length: 32 }).notNull(),
  codeHash: varchar("code_hash", { length: 128 }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("auth_challenge_identity_idx").on(table.identity, table.createdAt)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull(),
  familyId: uuid("family_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("session_user_active_idx").on(table.userId, table.expiresAt)]);

export const adminCredentials = pgTable("admin_credentials", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  ...timestamps,
});

export const gamerCredentials = pgTable("gamer_credentials", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  ...timestamps,
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })]);

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  scopeType: varchar("scope_type", { length: 32 }).default("platform").notNull(),
  scopeId: uuid("scope_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => [primaryKey({ columns: [table.userId, table.roleId, table.scopeType] })]);

export const countries = pgTable("countries", {
  id: uuid("id").primaryKey().defaultRandom(),
  iso2: varchar("iso2", { length: 2 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  phoneCode: varchar("phone_code", { length: 8 }).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const cities = pgTable("cities", {
  id: uuid("id").primaryKey().defaultRandom(),
  countryId: uuid("country_id").references(() => countries.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  regionName: varchar("region_name", { length: 120 }),
  timeZone: varchar("time_zone", { length: 64 }).notNull(),
}, (table) => [uniqueIndex("city_country_name_unique").on(table.countryId, table.name)]);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  genre: varchar("genre", { length: 80 }).default("Other").notNull(),
  publisher: varchar("publisher", { length: 120 }),
  teamSize: integer("team_size").default(1).notNull(),
  coverGradient: varchar("cover_gradient", { length: 120 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const gamerProfiles = pgTable("gamer_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  handle: varchar("handle", { length: 80 }).notNull(),
  bio: text("bio"),
  countryId: uuid("country_id").references(() => countries.id),
  cityId: uuid("city_id").references(() => cities.id),
  avatarUrl: text("avatar_url"),
  profileVisibility: visibility("profile_visibility").default("public").notNull(),
  verificationStatus: verificationStatus("verification_status").default("unverified").notNull(),
  rankingPoints: integer("ranking_points").default(0).notNull(),
  ...timestamps,
}, (table) => [index("gamer_location_idx").on(table.countryId, table.cityId)]);

export const gamerGames = pgTable("gamer_games", {
  gamerId: uuid("gamer_id").references(() => gamerProfiles.id, { onDelete: "cascade" }).notNull(),
  gameId: uuid("game_id").references(() => games.id, { onDelete: "cascade" }).notNull(),
  inGameName: varchar("in_game_name", { length: 100 }).notNull(),
  primaryRole: varchar("primary_role", { length: 80 }),
  platform: varchar("platform", { length: 64 }),
  verified: boolean("verified").default(false).notNull(),
}, (table) => [primaryKey({ columns: [table.gamerId, table.gameId] })]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  tag: varchar("tag", { length: 12 }).notNull().unique(),
  countryId: uuid("country_id").references(() => countries.id),
  logoUrl: text("logo_url"),
  verificationStatus: verificationStatus("verification_status").default("unverified").notNull(),
  ...timestamps,
});

export const teamMemberships = pgTable("team_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }).notNull(),
  gamerId: uuid("gamer_id").references(() => gamerProfiles.id, { onDelete: "cascade" }).notNull(),
  role: varchar("role", { length: 80 }).default("player").notNull(),
  isLeader: boolean("is_leader").default(false).notNull(),
  status: membershipStatus("status").default("active").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
}, (table) => [index("team_membership_active_idx").on(table.teamId, table.status)]);

export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 140 }).notNull(),
  category: varchar("category", { length: 80 }),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  verificationStatus: verificationStatus("verification_status").default("unverified").notNull(),
  ...timestamps,
});

export const sponsorships = pgTable("sponsorships", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "cascade" }).notNull(),
  subjectType: varchar("subject_type", { length: 24 }).notNull(),
  subjectId: uuid("subject_id").notNull(),
  status: sponsorshipStatus("status").default("proposed").notNull(),
  public: boolean("public").default(false).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...timestamps,
});

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  competitionType: competitionType("competition_type").default("tournament").notNull(),
  description: text("description"),
  status: tournamentStatus("status").default("draft").notNull(),
  countryId: uuid("country_id").references(() => countries.id),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
  actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  online: boolean("online").default(true).notNull(),
  featured: boolean("featured").default(false).notNull(),
  bannerUrl: text("banner_url"),
  ...timestamps,
});

export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  gameId: uuid("game_id").references(() => games.id).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  competitionType: competitionType("competition_type").default("tournament").notNull(),
  status: tournamentStatus("status").default("draft").notNull(),
  participantType: participantType("participant_type").notNull(),
  maxParticipants: integer("max_participants").notNull(),
  registrationRestricted: boolean("registration_restricted").default(false).notNull(),
  registrationLimit: integer("registration_limit"),
  rosterMin: integer("roster_min").default(1).notNull(),
  rosterMax: integer("roster_max").default(1).notNull(),
  rules: jsonb("rules").$type<Record<string, unknown>>().default({}).notNull(),
  actualStartedAt: timestamp("actual_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const registrations = pgTable("registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  divisionId: uuid("division_id").references(() => divisions.id, { onDelete: "cascade" }).notNull(),
  participantId: uuid("participant_id").notNull(),
  participantType: participantType("participant_type").notNull(),
  status: registrationStatus("status").default("registered").notNull(),
  displayNameSnapshot: varchar("display_name_snapshot", { length: 140 }).notNull(),
  seed: integer("seed"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  eligible: boolean("eligible").default(false).notNull(),
  rosterSnapshot: jsonb("roster_snapshot").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("registration_participant_unique").on(table.divisionId, table.participantId)]);

export const tournamentParticipantSnapshots = pgTable("tournament_participant_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  divisionId: uuid("division_id").references(() => divisions.id, { onDelete: "cascade" }).notNull(),
  participantId: uuid("participant_id").notNull(),
  participantType: participantType("participant_type").notNull(),
  displayName: varchar("display_name", { length: 140 }).notNull(),
  finalRank: integer("final_rank"),
  profileSnapshot: jsonb("profile_snapshot").$type<Record<string, unknown>>().default({}).notNull(),
  rosterSnapshot: jsonb("roster_snapshot").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  sponsorSnapshot: jsonb("sponsor_snapshot").$type<Array<Record<string, unknown>>>().default([]).notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("tournament_participant_snapshot_unique").on(table.divisionId, table.participantId),
  index("tournament_participant_snapshot_history_idx").on(table.participantId, table.capturedAt),
]);

export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  divisionId: uuid("division_id").references(() => divisions.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sequence: integer("sequence").notNull(),
  format: stageFormat("format").notNull(),
  status: stageStatus("status").default("draft").notNull(),
  configurationVersion: integer("configuration_version").default(1).notNull(),
  generatorVersion: varchar("generator_version", { length: 32 }).default("1.0.0").notNull(),
  randomSeed: varchar("random_seed", { length: 64 }),
  configuration: jsonb("configuration").$type<Record<string, unknown>>().default({}).notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("stage_sequence_unique").on(table.divisionId, table.sequence)]);

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  bracketLane: varchar("bracket_lane", { length: 24 }).default("main").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
}, (table) => [uniqueIndex("round_sequence_lane_unique").on(table.stageId, table.bracketLane, table.sequence)]);

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  roundId: uuid("round_id").references(() => rounds.id, { onDelete: "cascade" }).notNull(),
  code: varchar("code", { length: 40 }).notNull(),
  sequence: integer("sequence").notNull(),
  bestOf: integer("best_of").default(1).notNull(),
  status: matchStatus("status").default("scheduled").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  winnerParticipantId: uuid("winner_participant_id"),
  resultVersion: integer("result_version").default(0).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("match_stage_code_unique").on(table.stageId, table.code)]);

export const matchSides = pgTable("match_sides", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  slot: integer("slot").notNull(),
  participantId: uuid("participant_id"),
  displayNameSnapshot: varchar("display_name_snapshot", { length: 140 }),
  sourceMatchCode: varchar("source_match_code", { length: 40 }),
  sourceOutcome: varchar("source_outcome", { length: 16 }),
  score: integer("score").default(0).notNull(),
  outcome: varchar("outcome", { length: 24 }),
}, (table) => [uniqueIndex("match_side_slot_unique").on(table.matchId, table.slot)]);

export const standings = pgTable("standings", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  participantId: uuid("participant_id").notNull(),
  displayNameSnapshot: varchar("display_name_snapshot", { length: 140 }).notNull(),
  rank: integer("rank").notNull(),
  played: integer("played").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  points: integer("points").default(0).notNull(),
  scoreFor: integer("score_for").default(0).notNull(),
  scoreAgainst: integer("score_against").default(0).notNull(),
  tieBreakSnapshot: jsonb("tie_break_snapshot").$type<Record<string, number>>().default({}).notNull(),
}, (table) => [uniqueIndex("standing_participant_unique").on(table.stageId, table.participantId)]);

export const stageParticipants = pgTable("stage_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  participantId: uuid("participant_id").notNull(),
  participantType: participantType("participant_type").notNull(),
  displayNameSnapshot: varchar("display_name_snapshot", { length: 140 }).notNull(),
  seed: integer("seed").notNull(),
  groupKey: varchar("group_key", { length: 32 }),
  sourceStageId: uuid("source_stage_id"),
  sourceRank: integer("source_rank"),
}, (table) => [uniqueIndex("stage_participant_unique").on(table.stageId, table.participantId)]);

export const gameResults = pgTable("game_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  mapName: varchar("map_name", { length: 120 }),
  winnerParticipantId: uuid("winner_participant_id"),
  status: varchar("status", { length: 24 }).default("reported").notNull(),
  facts: jsonb("facts").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("game_result_sequence_unique").on(table.matchId, table.sequence)]);

export const participantStats = pgTable("participant_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }),
  gameResultId: uuid("game_result_id").references(() => gameResults.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id").notNull(),
  statKey: varchar("stat_key", { length: 80 }).notNull(),
  value: integer("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("participant_stat_projection_idx").on(table.stageId, table.participantId, table.statKey)]);

export const advancementRules = pgTable("advancement_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceStageId: uuid("source_stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  targetStageId: uuid("target_stage_id").references(() => stages.id, { onDelete: "cascade" }).notNull(),
  sourceFilter: jsonb("source_filter").$type<Record<string, unknown>>().notNull(),
  targetSeedMap: jsonb("target_seed_map").$type<Record<string, number>>().default({}).notNull(),
  sequence: integer("sequence").notNull(),
}, (table) => [uniqueIndex("advancement_rule_sequence_unique").on(table.sourceStageId, table.targetStageId, table.sequence)]);

export const disputes = pgTable("disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  openedByUserId: uuid("opened_by_user_id").references(() => users.id).notNull(),
  status: varchar("status", { length: 24 }).default("open").notNull(),
  reason: text("reason").notNull(),
  resolution: text("resolution"),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [index("dispute_match_status_idx").on(table.matchId, table.status)]);

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").references(() => users.id),
  objectKey: text("object_key").notNull().unique(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  altText: text("alt_text"),
  moderationStatus: varchar("moderation_status", { length: 24 }).default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tournamentMedia = pgTable("tournament_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "cascade" }).notNull(),
  caption: text("caption"),
  sequence: integer("sequence").default(0).notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("tournament_media_asset_unique").on(table.tournamentId, table.mediaAssetId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  channel: varchar("channel", { length: 24 }).notNull(),
  templateKey: varchar("template_key", { length: 80 }).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  status: varchar("status", { length: 24 }).default("queued").notNull(),
  providerReference: text("provider_reference"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("notification_delivery_idx").on(table.status, table.createdAt)]);

export const profileExports = pgTable("profile_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  gamerId: uuid("gamer_id").references(() => gamerProfiles.id, { onDelete: "cascade" }).notNull(),
  sourceVersion: integer("source_version").notNull(),
  objectKey: text("object_key"),
  checksum: varchar("checksum", { length: 128 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  url: text("url").notNull(),
  eventTypes: jsonb("event_types").$type<string[]>().default([]).notNull(),
  secretHash: varchar("secret_hash", { length: 128 }).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").references(() => webhookSubscriptions.id, { onDelete: "cascade" }).notNull(),
  outboxEventId: uuid("outbox_event_id").references(() => outboxEvents.id, { onDelete: "cascade" }).notNull(),
  attempt: integer("attempt").default(1).notNull(),
  statusCode: integer("status_code"),
  responseSummary: text("response_summary"),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("webhook_retry_idx").on(table.nextAttemptAt, table.deliveredAt)]);

export const homepageSlides = pgTable("homepage_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  eyebrow: varchar("eyebrow", { length: 80 }),
  title: varchar("title", { length: 180 }).notNull(),
  summary: text("summary"),
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  callToActionLabel: varchar("cta_label", { length: 60 }),
  callToActionUrl: text("cta_url"),
  sequence: integer("sequence").default(0).notNull(),
  published: boolean("published").default(false).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...timestamps,
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: uuid("entity_id"),
  requestId: varchar("request_id", { length: 80 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_entity_idx").on(table.entityType, table.entityId, table.createdAt)]);

export const streamBoards = pgTable("stream_boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: integer("number").notNull().unique(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "set null" }),
  featuredSlot: integer("featured_slot"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  aggregateType: varchar("aggregate_type", { length: 80 }).notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  type: varchar("type", { length: 120 }).notNull(),
  version: integer("version").default(1).notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  attempts: integer("attempts").default(0).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("outbox_unprocessed_idx").on(table.processedAt, table.createdAt)]);
