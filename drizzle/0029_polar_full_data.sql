CREATE TABLE "daily_polar_extras" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"cardio_load" real,
	"cardio_load_status" text,
	"cardio_load_strain" real,
	"cardio_load_tolerance" real,
	"cardio_load_ratio" real,
	"cardio_load_level" json,
	"cardio_load_raw" json,
	"continuous_hr_samples" json,
	"continuous_hr_raw" json,
	"alertness_raw" json,
	"circadian_bedtime_raw" json,
	"body_temperature_raw" json,
	"skin_temperature_raw" json,
	"spo2_raw" json,
	"wrist_ecg_raw" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "muscle_load" real;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "muscle_load_interpretation" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "running_index" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "weight_kg" real;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "vo2_max" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "training_background" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "typical_day" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sleep_goal_sec" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "physical_info_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "daily_polar_extras" ADD CONSTRAINT "daily_polar_extras_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_polar_extras_user_date_idx" ON "daily_polar_extras" USING btree ("user_id","date");