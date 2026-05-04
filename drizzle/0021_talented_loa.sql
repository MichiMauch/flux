CREATE TABLE "activity_group_members" (
	"group_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_group_members_group_id_activity_id_pk" PRIMARY KEY("group_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "activity_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cover_photo_path" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_group_members" ADD CONSTRAINT "activity_group_members_group_id_activity_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."activity_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_group_members" ADD CONSTRAINT "activity_group_members_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_groups" ADD CONSTRAINT "activity_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_group_members_activity_idx" ON "activity_group_members" USING btree ("activity_id");