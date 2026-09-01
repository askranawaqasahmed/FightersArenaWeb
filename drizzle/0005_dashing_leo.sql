CREATE TYPE "public"."registration_status" AS ENUM('registered', 'confirmed', 'withdrawn', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."match_status" ADD VALUE 'paused' BEFORE 'reported';--> statement-breakpoint
CREATE TABLE "tournament_participant_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"division_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"participant_type" "participant_type" NOT NULL,
	"display_name" varchar(140) NOT NULL,
	"final_rank" integer,
	"profile_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"roster_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sponsor_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "registration_restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "registration_limit" integer;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "status" "registration_status" DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "actual_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament_participant_snapshots" ADD CONSTRAINT "tournament_participant_snapshots_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participant_snapshots" ADD CONSTRAINT "tournament_participant_snapshots_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_participant_snapshot_unique" ON "tournament_participant_snapshots" USING btree ("division_id","participant_id");--> statement-breakpoint
CREATE INDEX "tournament_participant_snapshot_history_idx" ON "tournament_participant_snapshots" USING btree ("participant_id","captured_at");