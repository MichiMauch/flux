CREATE TABLE "deleted_polar_activities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"polar_id" text NOT NULL,
	"deleted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "deleted_polar_activities_polar_id_unique" UNIQUE("polar_id")
);
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "deleted_polar_activities" ADD CONSTRAINT "deleted_polar_activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;