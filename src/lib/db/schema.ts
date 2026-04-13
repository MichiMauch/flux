import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  json,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  password: text("password"), // bcrypt hash
  polarUserId: text("polar_user_id").unique(),
  polarToken: text("polar_token"),
  withingsAccessToken: text("withings_access_token"),
  withingsRefreshToken: text("withings_refresh_token"),
  withingsTokenExpiry: timestamp("withings_token_expiry"),
  withingsUserId: text("withings_user_id"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── NextAuth Tables ────────────────────────────────────────────────────────

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    primaryKey({
      columns: [vt.identifier, vt.token],
    }),
  ]
);

// ── Activities (Polar) ─────────────────────────────────────────────────────

export const activities = pgTable("activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  polarId: text("polar_id").unique(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // RUNNING, CYCLING, SWIMMING, etc.
  startTime: timestamp("start_time").notNull(),
  duration: integer("duration"), // seconds (elapsed time, incl. pauses)
  movingTime: integer("moving_time"), // seconds (timer time, excl. pauses)
  distance: real("distance"), // meters
  calories: integer("calories"),
  avgHeartRate: integer("avg_heart_rate"),
  maxHeartRate: integer("max_heart_rate"),
  ascent: real("ascent"),
  descent: real("descent"),
  routeData: json("route_data"), // [{lat, lng, time}]
  heartRateData: json("heart_rate_data"), // [{time, bpm}]
  speedData: json("speed_data"), // [{time, speed}]
  fatPercentage: integer("fat_percentage"),
  carbPercentage: integer("carb_percentage"),
  proteinPercentage: integer("protein_percentage"),
  minAltitude: real("min_altitude"),
  maxAltitude: real("max_altitude"),
  avgTemperature: real("avg_temperature"),
  minTemperature: real("min_temperature"),
  maxTemperature: real("max_temperature"),
  avgCadence: integer("avg_cadence"),
  maxCadence: integer("max_cadence"),
  totalSteps: integer("total_steps"),
  avgSpeed: real("avg_speed"),
  maxSpeed: real("max_speed"),
  cardioLoad: real("cardio_load"),
  cardioLoadInterpretation: text("cardio_load_interpretation"),
  device: text("device"),
  fitFilePath: text("fit_file_path"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Weight (Withings) ──────────────────────────────────────────────────────

export const weightMeasurements = pgTable("weight_measurements", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  withingsId: text("withings_id").unique(),
  date: timestamp("date").notNull(),
  weight: real("weight").notNull(), // kg
  fatMass: real("fat_mass"), // kg
  muscleMass: real("muscle_mass"), // kg
  bmi: real("bmi"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Blood Pressure (from blood-pressure-tracker) ───────────────────────────

export const bloodPressureSessions = pgTable("blood_pressure_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  sourceId: integer("source_id").unique(), // ID from blood-pressure-tracker
  measuredAt: timestamp("measured_at"), // real timestamp for sorting
  date: text("date").notNull(),
  time: text("time"),
  systolicAvg: real("systolic_avg").notNull(),
  diastolicAvg: real("diastolic_avg").notNull(),
  pulseAvg: real("pulse_avg"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
