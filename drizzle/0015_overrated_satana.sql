CREATE TABLE "coach_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"context_hash" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"model" text NOT NULL,
	"context" json NOT NULL,
	"suggestions" json NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_suggestions" ADD CONSTRAINT "coach_suggestions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;