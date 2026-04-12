CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"polar_id" text,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"duration" integer,
	"distance" real,
	"calories" integer,
	"avg_heart_rate" integer,
	"max_heart_rate" integer,
	"ascent" real,
	"descent" real,
	"route_data" json,
	"heart_rate_data" json,
	"speed_data" json,
	"fit_file_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activities_polar_id_unique" UNIQUE("polar_id")
);
--> statement-breakpoint
CREATE TABLE "blood_pressure_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer,
	"date" text NOT NULL,
	"time" text,
	"systolic_avg" real NOT NULL,
	"diastolic_avg" real NOT NULL,
	"pulse_avg" real,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blood_pressure_sessions_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"password" text,
	"polar_user_id" text,
	"polar_token" text,
	"withings_access_token" text,
	"withings_refresh_token" text,
	"withings_token_expiry" timestamp,
	"withings_user_id" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_polar_user_id_unique" UNIQUE("polar_user_id")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "weight_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"withings_id" text,
	"date" timestamp NOT NULL,
	"weight" real NOT NULL,
	"fat_mass" real,
	"muscle_mass" real,
	"bmi" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weight_measurements_withings_id_unique" UNIQUE("withings_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blood_pressure_sessions" ADD CONSTRAINT "blood_pressure_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_measurements" ADD CONSTRAINT "weight_measurements_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;