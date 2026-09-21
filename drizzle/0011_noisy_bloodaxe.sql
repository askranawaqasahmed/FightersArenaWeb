CREATE TABLE "gamer_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gamer_id" uuid NOT NULL,
	"category" varchar(32) DEFAULT 'highlight' NOT NULL,
	"title" varchar(200) NOT NULL,
	"detail" text,
	"game_id" uuid,
	"year_label" varchar(40),
	"sequence" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gamer_credentials" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "tournament_participant_snapshots" ADD COLUMN "placement_label" varchar(40);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "has_bracket" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "youtube_url" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "date_precision" varchar(8) DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "gamer_achievements" ADD CONSTRAINT "gamer_achievements_gamer_id_gamer_profiles_id_fk" FOREIGN KEY ("gamer_id") REFERENCES "public"."gamer_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamer_achievements" ADD CONSTRAINT "gamer_achievements_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gamer_achievement_order_idx" ON "gamer_achievements" USING btree ("gamer_id","category","sequence");