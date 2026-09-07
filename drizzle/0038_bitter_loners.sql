CREATE TABLE "daily_google_extras" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"azm_fat_burn" integer,
	"azm_cardio" integer,
	"azm_peak" integer,
	"active_minutes_light" integer,
	"active_minutes_moderate" integer,
	"active_minutes_vigorous" integer,
	"raw" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_google_extras" ADD CONSTRAINT "daily_google_extras_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_google_extras_user_date_idx" ON "daily_google_extras" USING btree ("user_id","date");