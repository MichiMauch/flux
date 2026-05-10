ALTER TABLE "daily_activity" ADD COLUMN "inactivity_alert_count" integer;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD COLUMN "inactive_duration_sec" integer;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD COLUMN "raw_v3" json;