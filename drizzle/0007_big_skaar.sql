ALTER TABLE "divisions" ADD COLUMN "status" "tournament_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "actual_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "divisions" AS d SET
  "status" = CASE
    WHEN EXISTS (SELECT 1 FROM "stages" s WHERE s."division_id" = d."id" AND s."status" = 'live') THEN 'live'::"tournament_status"
    WHEN EXISTS (SELECT 1 FROM "stages" s WHERE s."division_id" = d."id" AND s."status" = 'completed') THEN 'completed'::"tournament_status"
    ELSE (SELECT t."status" FROM "tournaments" t WHERE t."id" = d."tournament_id")
  END,
  "actual_started_at" = CASE WHEN EXISTS (SELECT 1 FROM "stages" s WHERE s."division_id" = d."id" AND s."locked_at" IS NOT NULL) THEN now() ELSE NULL END,
  "completed_at" = CASE WHEN EXISTS (SELECT 1 FROM "stages" s WHERE s."division_id" = d."id" AND s."status" = 'completed') THEN now() ELSE NULL END;
