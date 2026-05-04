import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  json,
  primaryKey,
  boolean,
  index,
  uniqueIndex,
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
  birthday: timestamp("birthday", { mode: "date" }),
  sex: text("sex"), // 'male' | 'female'
  heightCm: integer("height_cm"),
  maxHeartRate: integer("max_heart_rate"),
  restHeartRate: integer("rest_heart_rate"),
  aerobicThreshold: integer("aerobic_threshold"),
  anaerobicThreshold: integer("anaerobic_threshold"),
  partnerId: text("partner_id"),
  partnerPushEnabled: boolean("partner_push_enabled").notNull().default(true),
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
  avgCadence: integer("avg_cadence"),
  maxCadence: integer("max_cadence"),
  totalSteps: integer("total_steps"),
  avgSpeed: real("avg_speed"),
  maxSpeed: real("max_speed"),
  cardioLoad: real("cardio_load"),
  cardioLoadInterpretation: text("cardio_load_interpretation"),
  trimp: real("trimp"),
  notes: text("notes"),
  device: text("device"),
  fitFilePath: text("fit_file_path"),
  weather: json("weather"), // {temp, feelsLike, windSpeed, windDeg, clouds, description, icon, humidity}
  weatherFetchedAt: timestamp("weather_fetched_at"),
  locality: text("locality"), // Stadt/Stadtteil aus routeData[0] via Mapbox
  country: text("country"), // ISO-2 Country-Code (z.B. "CH", "FR")
  geocodedAt: timestamp("geocoded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Deleted Polar Activities (Blacklist for Re-Sync) ───────────────────────

export const deletedPolarActivities = pgTable("deleted_polar_activities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  polarId: text("polar_id").notNull().unique(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
});

// ── Activity Photos ────────────────────────────────────────────────────────

export const activityPhotos = pgTable("activity_photos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  takenAt: timestamp("taken_at"),
  location: text("location"),
  width: integer("width"),
  height: integer("height"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Activity Boosts (Likes / Kudos) ────────────────────────────────────────

export const activityBoosts = pgTable(
  "activity_boosts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueByUserAndActivity: uniqueIndex("activity_boosts_user_activity_unique").on(
      table.activityId,
      table.userId,
    ),
  }),
);

// ── Goals ──────────────────────────────────────────────────────────────────

export const goals = pgTable("goals", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  metric: text("metric").notNull(), // 'distance' | 'duration' | 'ascent' | 'count'
  activityType: text("activity_type"), // null = alle Typen
  timeframe: text("timeframe").notNull(), // 'week' | 'month' | 'year'
  targetValue: real("target_value").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Trophies ───────────────────────────────────────────────────────────────

export const userTrophies = pgTable("user_trophies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  trophyCode: text("trophy_code").notNull(),
  activityId: text("activity_id").references(() => activities.id, {
    onDelete: "set null",
  }),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const pendingUnlocks = pgTable("pending_unlocks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  trophyCode: text("trophy_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Daily Activity (Polar Activity Transactions) ───────────────────────────

export const dailyActivity = pgTable("daily_activity", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD local to device
  polarActivityId: text("polar_activity_id"),
  steps: integer("steps"),
  activeSteps: integer("active_steps"),
  calories: integer("calories"),
  activeCalories: integer("active_calories"),
  durationSec: integer("duration_sec"),
  distance: real("distance"), // meters
  activeTimeGoalSec: integer("active_time_goal_sec"),
  activeGoalCompletion: real("active_goal_completion"), // 0-1
  activeTimeZones: json("active_time_zones"), // raw array from Polar
  inactivityStamps: json("inactivity_stamps"), // array of ISO strings
  raw: json("raw"), // full Polar response for debug
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

// ── Sleep Sessions (Polar AccessLink /v3/users/sleep) ─────────────────────

export const sleepSessions = pgTable("sleep_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD (wake-up day per Polar)
  polarUserId: text("polar_user_id"),
  deviceId: text("device_id"),
  sleepStartTime: timestamp("sleep_start_time"),
  sleepEndTime: timestamp("sleep_end_time"),
  totalSleepSec: integer("total_sleep_sec"),
  continuity: real("continuity"),
  continuityClass: integer("continuity_class"),
  lightSleepSec: integer("light_sleep_sec"),
  deepSleepSec: integer("deep_sleep_sec"),
  remSleepSec: integer("rem_sleep_sec"),
  unrecognizedSleepSec: integer("unrecognized_sleep_sec"),
  sleepScore: integer("sleep_score"),
  sleepCharge: integer("sleep_charge"),
  sleepRating: integer("sleep_rating"),
  sleepGoalSec: integer("sleep_goal_sec"),
  shortInterruptionSec: integer("short_interruption_sec"),
  longInterruptionSec: integer("long_interruption_sec"),
  totalInterruptionSec: integer("total_interruption_sec"),
  sleepCycles: integer("sleep_cycles"),
  groupDurationScore: integer("group_duration_score"),
  groupSolidityScore: integer("group_solidity_score"),
  groupRegenerationScore: integer("group_regeneration_score"),
  hypnogram: json("hypnogram"),
  heartRateSamples: json("heart_rate_samples"),
  raw: json("raw"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Nightly Recharge (Polar AccessLink /v3/users/nights) ──────────────────

export const nightlyRecharge = pgTable("nightly_recharge", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  polarUserId: text("polar_user_id"),
  heartRateAvg: real("heart_rate_avg"),
  beatToBeatAvg: real("beat_to_beat_avg"),
  heartRateVariabilityAvg: real("heart_rate_variability_avg"),
  breathingRateAvg: real("breathing_rate_avg"),
  nightlyRechargeStatus: integer("nightly_recharge_status"),
  ansCharge: real("ans_charge"),
  ansChargeStatus: integer("ans_charge_status"),
  sleepCharge: integer("sleep_charge"),
  sleepChargeStatus: integer("sleep_charge_status"),
  raw: json("raw"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Push Subscriptions (Web Push / VAPID) ─────────────────────────────────

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
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

// ── Coach Suggestions (AI-generated training recommendations) ─────────────

export const coachSuggestions = pgTable("coach_suggestions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contextHash: text("context_hash").notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  model: text("model").notNull(),
  context: json("context").notNull(),
  suggestions: json("suggestions").notNull(),
});

// ── Weekly Briefings (AI-generated weekly recap + next-week plan) ─────────

export const weeklyBriefings = pgTable(
  "weekly_briefings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isoWeek: text("iso_week").notNull(), // YYYY-WW, references the recapped (completed) week
    weekStart: text("week_start").notNull(), // YYYY-MM-DD (Monday of recapped week)
    weekEnd: text("week_end").notNull(), // YYYY-MM-DD (Sunday of recapped week)
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
    model: text("model").notNull(),
    recap: json("recap").notNull(),
    summary: text("summary").notNull(),
    highlights: json("highlights").notNull(),
    warnings: json("warnings").notNull(),
    suggestions: json("suggestions").notNull(),
    seenAt: timestamp("seen_at"),
  },
  (t) => [uniqueIndex("weekly_briefings_user_iso_week_idx").on(t.userId, t.isoWeek)]
);

// ── In-App Notifications (mirror of Web-Push pushes) ──────────────────────

export const notifications = pgTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url").notNull().default("/"),
  kind: text("kind"),
  tag: text("tag"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Activity Groups (Sammlungen mehrerer Aktivitäten) ─────────────────────

export const activityGroups = pgTable("activity_groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  coverPhotoPath: text("cover_photo_path"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityGroupMembers = pgTable(
  "activity_group_members",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => activityGroups.id, { onDelete: "cascade" }),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.activityId] }),
    index("activity_group_members_activity_idx").on(t.activityId),
  ]
);
