CREATE TABLE "activity_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"file_path" text NOT NULL,
	"thumbnail_path" text NOT NULL,
	"lat" real,
	"lng" real,
	"taken_at" timestamp,
	"width" integer,
	"height" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_photos" ADD CONSTRAINT "activity_photos_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;