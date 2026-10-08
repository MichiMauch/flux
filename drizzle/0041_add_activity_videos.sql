CREATE TABLE "activity_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"file_path" text,
	"poster_path" text,
	"original_name" text,
	"duration_sec" real,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"story_path" text,
	"story_status" text,
	"story_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_videos" ADD CONSTRAINT "activity_videos_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_videos_activity_idx" ON "activity_videos" USING btree ("activity_id");