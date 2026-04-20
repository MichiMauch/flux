CREATE TABLE "weekly_briefings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"iso_week" text NOT NULL,
	"week_start" text NOT NULL,
	"week_end" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"recap" json NOT NULL,
	"summary" text NOT NULL,
	"highlights" json NOT NULL,
	"warnings" json NOT NULL,
	"suggestions" json NOT NULL,
	"seen_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "weekly_briefings" ADD CONSTRAINT "weekly_briefings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_briefings_user_iso_week_idx" ON "weekly_briefings" USING btree ("user_id","iso_week");