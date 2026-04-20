import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activities,
  sleepSessions,
  weightMeasurements,
} from "@/lib/db/schema";
import { getDailyTrimp } from "@/lib/training-load-query";
import {
  CTL_TAU_DAYS,
  computeTrainingLoadSeries,
  getFormZone,
  type FormZone,
} from "@/lib/training-load";
import { dayKey } from "@/lib/streak";

export interface WeeklyRecap {
  isoWeek: string; // YYYY-WW (ISO 8601)
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  totalTrimp: number;
  totalDistanceKm: number;
  totalHours: number;
  totalAscentM: number;
  activityCount: number;
  activeDays: number;
  sportMix: Record<string, number>;
  tsbStart: number;
  tsbEnd: number;
  ctlStart: number;
  ctlEnd: number;
  zoneStart: FormZone;
  zoneEnd: FormZone;
  maxFatigue: number; // highest ATL during the week
  minBalance: number; // lowest TSB during the week
  overloadDays: number; // TSB < -30 within the week
  sleep: {
    nights: number;
    avgScore: number | null;
    avgHours: number | null;
  };
  weight: {
    startKg: number | null;
    endKg: number | null;
    deltaKg: number | null;
  };
  activities: Array<{
    date: string;
    type: string;
    durationMin: number;
    distanceKm: number | null;
    trimp: number | null;
    avgHr: number | null;
    ascentM: number | null;
  }>;
}

/**
 * Build a self-contained recap of a completed ISO week (Mon 00:00 – Sun 23:59).
 * Used by the weekly briefing generator. Language-agnostic: everything is
 * pre-aggregated numbers for the LLM to narrate.
 */
export async function buildWeeklyRecap(
  userId: string,
  weekStart: Date
): Promise<WeeklyRecap> {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  // --- Activities in week ---
  const rows = await db
    .select({
      startTime: activities.startTime,
      type: activities.type,
      duration: activities.duration,
      movingTime: activities.movingTime,
      distance: activities.distance,
      trimp: activities.trimp,
      avgHeartRate: activities.avgHeartRate,
      ascent: activities.ascent,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, start),
        lte(activities.startTime, end)
      )
    )
    .orderBy(activities.startTime);

  let totalTrimp = 0;
  let totalDistance = 0; // meters
  let totalSeconds = 0;
  let totalAscent = 0;
  const sportMix: Record<string, number> = {};
  const activeDaySet = new Set<string>();
  for (const a of rows) {
    totalTrimp += a.trimp ?? 0;
    totalDistance += a.distance ?? 0;
    totalSeconds += a.movingTime ?? a.duration ?? 0;
    totalAscent += a.ascent ?? 0;
    sportMix[a.type] = (sportMix[a.type] ?? 0) + 1;
    activeDaySet.add(dayKey(a.startTime));
  }

  // --- Training load series around the week (pre-roll for CTL) ---
  const ctlStart = new Date(start);
  ctlStart.setDate(ctlStart.getDate() - CTL_TAU_DAYS);
  ctlStart.setHours(0, 0, 0, 0);

  const daily = await getDailyTrimp(userId, ctlStart, end);
  const series = computeTrainingLoadSeries(daily, ctlStart, end);
  const startKey = dayKey(start);
  const endKey = dayKey(end);
  const weekSeries = series.filter(
    (p) => p.date >= startKey && p.date <= endKey
  );
  const first = weekSeries[0];
  const last = weekSeries[weekSeries.length - 1];
  const tsbStart = first ? first.tsb : 0;
  const tsbEnd = last ? last.tsb : 0;
  const ctlStartVal = first ? first.ctl : 0;
  const ctlEndVal = last ? last.ctl : 0;
  let maxAtl = 0;
  let minTsb = Infinity;
  let overloadDays = 0;
  for (const p of weekSeries) {
    if (p.atl > maxAtl) maxAtl = p.atl;
    if (p.tsb < minTsb) minTsb = p.tsb;
    if (p.tsb < -30) overloadDays += 1;
  }
  if (!isFinite(minTsb)) minTsb = 0;

  // --- Sleep (nights falling on weekStart..weekEnd by date field YYYY-MM-DD) ---
  const sleepRows = await db
    .select({
      score: sleepSessions.sleepScore,
      totalSleepSec: sleepSessions.totalSleepSec,
    })
    .from(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, userId),
        gte(sleepSessions.date, startKey),
        lte(sleepSessions.date, endKey)
      )
    );
  const scored = sleepRows.filter((r) => r.score != null);
  const avgSleepScore =
    scored.length > 0
      ? round1(
          scored.reduce((s, r) => s + (r.score as number), 0) / scored.length
        )
      : null;
  const hoursRows = sleepRows.filter((r) => r.totalSleepSec != null);
  const avgSleepHours =
    hoursRows.length > 0
      ? round1(
          hoursRows.reduce((s, r) => s + (r.totalSleepSec as number), 0) /
            hoursRows.length /
            3600
        )
      : null;

  // --- Weight: earliest and latest measurement inside the week ---
  const weightRows = await db
    .select({
      date: weightMeasurements.date,
      weight: weightMeasurements.weight,
    })
    .from(weightMeasurements)
    .where(
      and(
        eq(weightMeasurements.userId, userId),
        gte(weightMeasurements.date, start),
        lte(weightMeasurements.date, end)
      )
    )
    .orderBy(desc(weightMeasurements.date));
  const weightEnd = weightRows[0] ?? null;
  const weightStart = weightRows[weightRows.length - 1] ?? null;
  const weightStartKg = weightStart ? round1(weightStart.weight) : null;
  const weightEndKg = weightEnd ? round1(weightEnd.weight) : null;
  const weightDelta =
    weightStart && weightEnd && weightStart !== weightEnd
      ? round1(weightEnd.weight - weightStart.weight)
      : null;

  return {
    isoWeek: toIsoWeekKey(start),
    weekStart: startKey,
    weekEnd: endKey,
    totalTrimp: round1(totalTrimp),
    totalDistanceKm: round1(totalDistance / 1000),
    totalHours: round1(totalSeconds / 3600),
    totalAscentM: Math.round(totalAscent),
    activityCount: rows.length,
    activeDays: activeDaySet.size,
    sportMix,
    tsbStart: round1(tsbStart),
    tsbEnd: round1(tsbEnd),
    ctlStart: round1(ctlStartVal),
    ctlEnd: round1(ctlEndVal),
    zoneStart: getFormZone(tsbStart).id,
    zoneEnd: getFormZone(tsbEnd).id,
    maxFatigue: round1(maxAtl),
    minBalance: round1(minTsb),
    overloadDays,
    sleep: {
      nights: sleepRows.length,
      avgScore: avgSleepScore,
      avgHours: avgSleepHours,
    },
    weight: {
      startKg: weightStartKg,
      endKg: weightEndKg,
      deltaKg: weightDelta,
    },
    activities: rows.map((a) => ({
      date: dayKey(a.startTime),
      type: a.type,
      durationMin: Math.round((a.movingTime ?? a.duration ?? 0) / 60),
      distanceKm:
        a.distance != null ? Math.round((a.distance / 1000) * 10) / 10 : null,
      trimp: a.trimp != null ? Math.round(a.trimp * 10) / 10 : null,
      avgHr: a.avgHeartRate ?? null,
      ascentM: a.ascent != null ? Math.round(a.ascent) : null,
    })),
  };
}

/**
 * Monday of the ISO week that contains `date`. Weeks are Monday-based;
 * setHours(0,0,0,0) happens at the caller.
 */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diff = (day + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - diff);
  return d;
}

/**
 * ISO 8601 week key "YYYY-WW". The year is the ISO-week year (may differ
 * from the calendar year at year boundaries).
 */
export function toIsoWeekKey(anyDateInWeek: Date): string {
  // Copy to avoid mutating input; work in UTC to dodge DST edge cases.
  const d = new Date(
    Date.UTC(
      anyDateInWeek.getFullYear(),
      anyDateInWeek.getMonth(),
      anyDateInWeek.getDate()
    )
  );
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // move to Thursday of same ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-${week.toString().padStart(2, "0")}`;
}

/** Monday of the ISO week that the user would now think of as "last week". */
export function previousWeekStart(now: Date = new Date()): Date {
  const thisWeekMon = startOfIsoWeek(now);
  const last = new Date(thisWeekMon);
  last.setDate(last.getDate() - 7);
  return last;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
