ALTER TABLE "activities" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "activity_groups" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
ALTER TABLE "activity_groups" ADD CONSTRAINT "activity_groups_share_token_unique" UNIQUE("share_token");