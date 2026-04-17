import { db } from "@/lib/db";
import {
  activities,
  sleepSessions,
  nightlyRecharge,
  weightMeasurements,
  bloodPressureSessions,
  dailyActivity,
} from "@/lib/db/schema";
import { and, eq, gte, lt, sql, desc, asc } from "drizzle-orm";
import { rangeBounds, isYearRange, type TimeRange } from "./filters";

export type Bucket = "daily" | "weekly" | "monthly";

export function pickBucket(range: TimeRange): Bucket {
  if (isYearRange(range)) return "weekly";
  if (range === "30d" || range === "90d") return "daily";
  if (range === "ytd" || range === "12m") return "weekly";
  return "monthly";
}

function textDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function activitiesWhere(
  userId: string,
  range: TimeRange,
  sport: string | null
) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(activities.userId, userId)];
  if (start) parts.push(gte(activities.startTime, start));
  if (end) parts.push(lt(activities.startTime, end));
  if (sport) parts.push(eq(activities.type, sport));
  return and(...parts);
}

// ── Activities ────────────────────────────────────────────────────────────

export async function getActivityTotals(
  userId: string,
  range: TimeRange,
  sport: string | null
) {
  const rows = await db
    .select({
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
      totalCalories: sql<number>`coalesce(sum(${activities.calories}), 0)`,
    })
    .from(activities)
    .where(activitiesWhere(userId, range, sport));
  return rows[0];
}

export async function getActivitiesBySport(
  userId: string,
  range: TimeRange
) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(activities.userId, userId)];
  if (start) parts.push(gte(activities.startTime, start));
  if (end) parts.push(lt(activities.startTime, end));

  return db
    .select({
      type: activities.type,
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
    })
    .from(activities)
    .where(and(...parts))
    .groupBy(activities.type)
    .orderBy(desc(sql`sum(${activities.distance})`));
}

export async function getAvailableSports(userId: string) {
  const rows = await db
    .selectDistinct({ type: activities.type })
    .from(activities)
    .where(eq(activities.userId, userId));
  return rows.map((r) => r.type).sort();
}

export async function getAvailableYears(userId: string): Promise<number[]> {
  const years = new Set<number>();

  const add = (val: string | number | null | undefined) => {
    if (val == null) return;
    const y = typeof val === "string" ? parseInt(val.slice(0, 4), 10) : val;
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) years.add(y);
  };

  const [actRows, sleepRows, rechargeRows, weightRows, bpRows, dailyRows] =
    await Promise.all([
      db
        .selectDistinct({
          y: sql<number>`extract(year from ${activities.startTime})::int`,
        })
        .from(activities)
        .where(eq(activities.userId, userId)),
      db
        .selectDistinct({
          y: sql<string>`substring(${sleepSessions.date}, 1, 4)`,
        })
        .from(sleepSessions)
        .where(eq(sleepSessions.userId, userId)),
      db
        .selectDistinct({
          y: sql<string>`substring(${nightlyRecharge.date}, 1, 4)`,
        })
        .from(nightlyRecharge)
        .where(eq(nightlyRecharge.userId, userId)),
      db
        .selectDistinct({
          y: sql<number>`extract(year from ${weightMeasurements.date})::int`,
        })
        .from(weightMeasurements)
        .where(eq(weightMeasurements.userId, userId)),
      db
        .selectDistinct({
          y: sql<number>`extract(year from ${bloodPressureSessions.measuredAt})::int`,
        })
        .from(bloodPressureSessions)
        .where(eq(bloodPressureSessions.userId, userId)),
      db
        .selectDistinct({
          y: sql<string>`substring(${dailyActivity.date}, 1, 4)`,
        })
        .from(dailyActivity)
        .where(eq(dailyActivity.userId, userId)),
    ]);

  for (const r of actRows) add(r.y);
  for (const r of sleepRows) add(r.y);
  for (const r of rechargeRows) add(r.y);
  for (const r of weightRows) add(r.y);
  for (const r of bpRows) add(r.y);
  for (const r of dailyRows) add(r.y);

  return Array.from(years).sort((a, b) => b - a);
}

export async function getActivitiesTimeSeries(
  userId: string,
  range: TimeRange,
  sport: string | null,
  bucket: Bucket
) {
  const where = activitiesWhere(userId, range, sport);

  const trunc =
    bucket === "daily"
      ? sql`to_char(${activities.startTime}, 'YYYY-MM-DD')`
      : bucket === "weekly"
        ? sql`to_char(${activities.startTime}, 'IYYY-"W"IW')`
        : sql`to_char(${activities.startTime}, 'YYYY-MM')`;

  return db
    .select({
      bucket: sql<string>`${trunc}`,
      count: sql<number>`count(*)`,
      totalDistance: sql<number>`coalesce(sum(${activities.distance}), 0)`,
      totalDuration: sql<number>`coalesce(sum(${activities.duration}), 0)`,
      totalAscent: sql<number>`coalesce(sum(${activities.ascent}), 0)`,
    })
    .from(activities)
    .where(where)
    .groupBy(trunc)
    .orderBy(asc(trunc));
}

// ── Sleep ────────────────────────────────────────────────────────────────

export async function getSleepData(userId: string, range: TimeRange) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(sleepSessions.userId, userId)];
  if (start) parts.push(gte(sleepSessions.date, textDateStr(start)));
  if (end) parts.push(lt(sleepSessions.date, textDateStr(end)));

  const rows = await db
    .select({
      date: sleepSessions.date,
      score: sleepSessions.sleepScore,
      charge: sleepSessions.sleepCharge,
      totalSleepSec: sleepSessions.totalSleepSec,
      lightSec: sleepSessions.lightSleepSec,
      deepSec: sleepSessions.deepSleepSec,
      remSec: sleepSessions.remSleepSec,
      unrecognizedSec: sleepSessions.unrecognizedSleepSec,
    })
    .from(sleepSessions)
    .where(and(...parts))
    .orderBy(asc(sleepSessions.date));

  return rows;
}

// ── Nightly Recharge ─────────────────────────────────────────────────────

export async function getRechargeData(userId: string, range: TimeRange) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(nightlyRecharge.userId, userId)];
  if (start) parts.push(gte(nightlyRecharge.date, textDateStr(start)));
  if (end) parts.push(lt(nightlyRecharge.date, textDateStr(end)));

  return db
    .select({
      date: nightlyRecharge.date,
      hrv: nightlyRecharge.heartRateVariabilityAvg,
      ansCharge: nightlyRecharge.ansCharge,
      heartRate: nightlyRecharge.heartRateAvg,
      breathingRate: nightlyRecharge.breathingRateAvg,
    })
    .from(nightlyRecharge)
    .where(and(...parts))
    .orderBy(asc(nightlyRecharge.date));
}

// ── Weight ────────────────────────────────────────────────────────────────

export async function getWeightData(userId: string, range: TimeRange) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(weightMeasurements.userId, userId)];
  if (start) parts.push(gte(weightMeasurements.date, start));
  if (end) parts.push(lt(weightMeasurements.date, end));

  return db
    .select({
      date: weightMeasurements.date,
      weight: weightMeasurements.weight,
      fatMass: weightMeasurements.fatMass,
      muscleMass: weightMeasurements.muscleMass,
      bmi: weightMeasurements.bmi,
    })
    .from(weightMeasurements)
    .where(and(...parts))
    .orderBy(asc(weightMeasurements.date));
}

// ── Blood Pressure ───────────────────────────────────────────────────────

export async function getBloodPressureData(
  userId: string,
  range: TimeRange
) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(bloodPressureSessions.userId, userId)];
  if (start) parts.push(gte(bloodPressureSessions.measuredAt, start));
  if (end) parts.push(lt(bloodPressureSessions.measuredAt, end));

  return db
    .select({
      date: bloodPressureSessions.date,
      measuredAt: bloodPressureSessions.measuredAt,
      systolic: bloodPressureSessions.systolicAvg,
      diastolic: bloodPressureSessions.diastolicAvg,
      pulse: bloodPressureSessions.pulseAvg,
    })
    .from(bloodPressureSessions)
    .where(and(...parts))
    .orderBy(asc(bloodPressureSessions.measuredAt));
}

// ── Daily Activity ───────────────────────────────────────────────────────

export async function getDailyActivityData(userId: string, range: TimeRange) {
  const { start, end } = rangeBounds(range);
  const parts = [eq(dailyActivity.userId, userId)];
  if (start) parts.push(gte(dailyActivity.date, textDateStr(start)));
  if (end) parts.push(lt(dailyActivity.date, textDateStr(end)));

  return db
    .select({
      date: dailyActivity.date,
      steps: dailyActivity.steps,
      durationSec: dailyActivity.durationSec,
      calories: dailyActivity.calories,
    })
    .from(dailyActivity)
    .where(and(...parts))
    .orderBy(asc(dailyActivity.date));
}
