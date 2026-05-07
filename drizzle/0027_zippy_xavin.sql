ALTER TABLE "user" ADD COLUMN "withings_webhook_token" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_withings_webhook_token_unique" UNIQUE("withings_webhook_token");