ALTER TABLE "user" ADD COLUMN "partner_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "partner_push_enabled" boolean DEFAULT true NOT NULL;