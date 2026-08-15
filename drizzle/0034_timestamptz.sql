-- timestamp -> timestamptz fuer alle 45 Zeitspalten.
--
-- Die Bestandswerte sind UTC-Wandzeit: die DB laeuft in UTC, 24 Spalten
-- haengen an DEFAULT now(), und alles was ueber Drizzle geschrieben wird
-- geht als toISOString() rein. Vor allem aber liest der Prod-Container in
-- UTC — die Zeiten die die App heute anzeigt, entstehen also aus genau
-- dieser Interpretation. AT TIME ZONE 'UTC' haelt sie unveraendert.
--
-- Das USING ist bewusst explizit. Ohne die Klausel wuerde Postgres die
-- Werte in der Session-TimeZone interpretieren, und die Migration haette
-- je nach ausfuehrendem Client ein anderes Ergebnis.

ALTER TABLE "activities" ALTER COLUMN "start_time" SET DATA TYPE timestamp with time zone USING "start_time" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "weather_fetched_at" SET DATA TYPE timestamp with time zone USING "weather_fetched_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "geocoded_at" SET DATA TYPE timestamp with time zone USING "geocoded_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activities" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_boosts" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_boosts" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_photos" ALTER COLUMN "taken_at" SET DATA TYPE timestamp with time zone USING "taken_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_photos" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_photos" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_group_members" ALTER COLUMN "added_at" SET DATA TYPE timestamp with time zone USING "added_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_group_members" ALTER COLUMN "added_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "start_date" SET DATA TYPE timestamp with time zone USING "start_date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "end_date" SET DATA TYPE timestamp with time zone USING "end_date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "activity_groups" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "blood_pressure_sessions" ALTER COLUMN "measured_at" SET DATA TYPE timestamp with time zone USING "measured_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "blood_pressure_sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "blood_pressure_sessions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "coach_suggestions" ALTER COLUMN "generated_at" SET DATA TYPE timestamp with time zone USING "generated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "coach_suggestions" ALTER COLUMN "generated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_activity" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "daily_activity" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_activity" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "daily_activity" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_polar_extras" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "daily_polar_extras" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "daily_polar_extras" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "daily_polar_extras" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "deleted_polar_activities" ALTER COLUMN "deleted_at" SET DATA TYPE timestamp with time zone USING "deleted_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "deleted_polar_activities" ALTER COLUMN "deleted_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "nightly_recharge" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "nightly_recharge" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "nightly_recharge" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "nightly_recharge" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "read_at" SET DATA TYPE timestamp with time zone USING "read_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "pending_unlocks" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "pending_unlocks" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "last_used_at" SET DATA TYPE timestamp with time zone USING "last_used_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone USING "expires" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "sleep_start_time" SET DATA TYPE timestamp with time zone USING "sleep_start_time" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "sleep_end_time" SET DATA TYPE timestamp with time zone USING "sleep_end_time" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "sleep_sessions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_trophies" ALTER COLUMN "unlocked_at" SET DATA TYPE timestamp with time zone USING "unlocked_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user_trophies" ALTER COLUMN "unlocked_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DATA TYPE timestamp with time zone USING "emailVerified" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "withings_token_expiry" SET DATA TYPE timestamp with time zone USING "withings_token_expiry" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "birthday" SET DATA TYPE timestamp with time zone USING "birthday" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "physical_info_synced_at" SET DATA TYPE timestamp with time zone USING "physical_info_synced_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "verificationToken" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone USING "expires" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "weekly_briefings" ALTER COLUMN "generated_at" SET DATA TYPE timestamp with time zone USING "generated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "weekly_briefings" ALTER COLUMN "generated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "weekly_briefings" ALTER COLUMN "seen_at" SET DATA TYPE timestamp with time zone USING "seen_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "weight_measurements" ALTER COLUMN "date" SET DATA TYPE timestamp with time zone USING "date" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "weight_measurements" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "weight_measurements" ALTER COLUMN "created_at" SET DEFAULT now();