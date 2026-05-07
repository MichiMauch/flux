CREATE INDEX "activities_user_start_idx" ON "activities" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "activities_user_type_start_idx" ON "activities" USING btree ("user_id","type","start_time");--> statement-breakpoint
CREATE INDEX "activity_photos_activity_idx" ON "activity_photos" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "blood_pressure_sessions_user_measured_idx" ON "blood_pressure_sessions" USING btree ("user_id","measured_at");--> statement-breakpoint
CREATE INDEX "daily_activity_user_date_idx" ON "daily_activity" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "goals_user_active_idx" ON "goals" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "nightly_recharge_user_date_idx" ON "nightly_recharge" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sleep_sessions_user_date_idx" ON "sleep_sessions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "weight_measurements_user_date_idx" ON "weight_measurements" USING btree ("user_id","date");