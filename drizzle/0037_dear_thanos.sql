ALTER TABLE "user" ADD COLUMN "google_access_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_token_expiry" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_health_user_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_daily_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "google_sleep_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_google_health_user_id_unique" UNIQUE("google_health_user_id");