CREATE TABLE "nightly_recharge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"polar_user_id" text,
	"heart_rate_avg" real,
	"beat_to_beat_avg" real,
	"heart_rate_variability_avg" real,
	"breathing_rate_avg" real,
	"nightly_recharge_status" integer,
	"ans_charge" real,
	"ans_charge_status" integer,
	"sleep_charge" integer,
	"sleep_charge_status" integer,
	"raw" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"polar_user_id" text,
	"device_id" text,
	"sleep_start_time" timestamp,
	"sleep_end_time" timestamp,
	"total_sleep_sec" integer,
	"continuity" real,
	"continuity_class" integer,
	"light_sleep_sec" integer,
	"deep_sleep_sec" integer,
	"rem_sleep_sec" integer,
	"unrecognized_sleep_sec" integer,
	"sleep_score" integer,
	"sleep_charge" integer,
	"sleep_rating" integer,
	"sleep_goal_sec" integer,
	"short_interruption_sec" integer,
	"long_interruption_sec" integer,
	"total_interruption_sec" integer,
	"sleep_cycles" integer,
	"group_duration_score" integer,
	"group_solidity_score" integer,
	"group_regeneration_score" integer,
	"hypnogram" json,
	"heart_rate_samples" json,
	"raw" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nightly_recharge" ADD CONSTRAINT "nightly_recharge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_sessions" ADD CONSTRAINT "sleep_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;