ALTER TABLE "activities" ADD COLUMN "trimp" real;--> statement-breakpoint
ALTER TABLE "activity_photos" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "birthday" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "sex" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "max_heart_rate" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "rest_heart_rate" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "aerobic_threshold" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "anaerobic_threshold" integer;