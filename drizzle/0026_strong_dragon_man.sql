ALTER TABLE "activity_group_members" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "activity_groups" ADD COLUMN "sort_mode" text DEFAULT 'date' NOT NULL;--> statement-breakpoint
CREATE INDEX "activity_group_members_tour_sort_idx" ON "activity_group_members" USING btree ("group_id","sort_order");