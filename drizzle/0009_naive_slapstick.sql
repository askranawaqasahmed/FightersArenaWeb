CREATE TABLE "stream_boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" integer NOT NULL,
	"match_id" uuid,
	"featured_slot" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stream_boards_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "stream_boards" ADD CONSTRAINT "stream_boards_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;