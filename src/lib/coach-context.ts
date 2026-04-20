import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  activities,
  goals,
  sleepSessions,
  users,
  weightMeasurements,
} from "@/lib/db/schema";
import { startOfWeek } from "@/lib/activity-week";
import { computeHrZones, type HrZone, type HrSample } from "@/lib/hr-zones";
import { computeGoalProgress } from "@/lib/goals-server";
import type { Goal } from "@/lib/goals";
import { getDailyTrimp } from "@/lib/training-load-query";
import {
  CTL_TAU_DAYS,
  computeReadiness,
  computeTrainingLoadSeries,
  getFormZone,
  type FormZone,
} from "@/lib/training-load";
import {
  currentStreak,
  dayKey,
  daysSinceLastActive,
} from "@/lib/streak";

export interface CoachContext {
  today: string;
  weekday: string;
  user: {
    name: string | null;
    sex: "male" | "female" | null;
    age: number | null;
    hrMax: number | null;
    hrRest: number | null;
    hasZoneThresholds: boolean;
  };
  trainingLoad: {
    ctl: number;
    atl: number;
    tsb: number;
    readiness: number;
    zone: FormZone;
    zoneLabel: string;
    ctlDelta7d: number;
    ctlDelta28d: number;
  };
  recentActivities: Array<{
    date: string;
    type: string;
    durationMin: number;
    distanceKm: number | null;
    trimp: number | null;
    avgHr: number | null;
    ascentM: number | null;
  }>;
  weekly: {
    trimpThisWeek: number;
    trimpLastWeek: number;
    activitiesThisWeek: number;
    activitiesLastWeek: number;
    avgWeeklyTrimp28d: number;
  };
  sportMix28d: Record<string, number>;
  hrZoneMix28d: {
    z1Pct: number;
    z2Pct: number;
    z3Pct: number;
    z4Pct: number;
    z5Pct: number;
    totalMinutes: number;
    source: "thresholds" | "hrmax" | "none";
  };
  consistency: {
    currentStreakDays: number;
    daysSinceLastActivity: number | null;
    activeDaysLast28: number;
  };
  goals: Array<{
    title: string | null;
    metric: Goal["metric"];
    timeframe: Goal["timeframe"];
    activityType: string | null;
    targetValue: number;
    currentValue: number;
    progressPct: number;
    daysRemaining: number;
    expectedPacePerDay: number;
    onPace: boolean;
  }>;
  sleep: {
    nights7d: number;
    avgScore7d: number | null;
    avgHours7d: number | null;
    nights28d: number;
    avgScore28d: number | null;
    avgHours28d: number | null;
    trend: "improving" | "declining" | "flat" | "unknown";
  };
  weight: {
    latestKg: number | null;
    latestDate: string | null;
    delta7dKg: number | null;
    delta28dKg: number | null;
    measurements28d: number;
    trend: "up" | "down" | "flat" | "unknown";
  };
}

const WEEKDAYS_DE = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

/**
 * Build a self-contained snapshot of a user's training state for the AI
 * coach. Everything is pre-aggregated and language-agnostic so the LLM only
 * has to turn numbers into prose.
 */
export async function buildCoachContext(
  userId: string,
  now: Date = new Date()
): Promise<CoachContext> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  const ctxStart = new Date(now);
  ctxStart.setDate(ctxStart.getDate() - 28);
  ctxStart.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // --- TRIMP history window for CTL/ATL ---
  // Use a year of data plus CTL_TAU_DAYS pre-roll so the computed TSB matches
  // what the user sees on /training-load regardless of the range switcher.
  // Short pre-roll windows give visibly different EWMA values.
  const ctlStart = new Date(now);
  ctlStart.setDate(ctlStart.getDate() - (365 + CTL_TAU_DAYS));
  ctlStart.setHours(0, 0, 0, 0);

  const recent28 = await db
    .select({
      id: activities.id,
      startTime: activities.startTime,
      type: activities.type,
      duration: activities.duration,
      movingTime: activities.movingTime,
      distance: activities.distance,
      trimp: activities.trimp,
      avgHeartRate: activities.avgHeartRate,
      ascent: activities.ascent,
      heartRateData: activities.heartRateData,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, ctxStart),
        lte(activities.startTime, endOfToday)
      )
    )
    .orderBy(desc(activities.startTime));

  // --- Training load (CTL/ATL/TSB for today, 7d and 28d ago) ---
  const daily = await getDailyTrimp(userId, ctlStart, endOfToday);
  const series = computeTrainingLoadSeries(daily, ctlStart, endOfToday);
  const today = series[series.length - 1] ?? {
    date: dayKey(now),
    trimp: 0,
    ctl: 0,
    atl: 0,
    tsb: 0,
  };
  const d7 = series[series.length - 8] ?? today;
  const d28 = series[series.length - 29] ?? today;

  const zone = getFormZone(today.tsb);

  // --- Weekly summary ---
  const weekStart = startOfWeek(now);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let trimpThisWeek = 0;
  let trimpLastWeek = 0;
  let activitiesThisWeek = 0;
  let activitiesLastWeek = 0;
  let trimp28d = 0;
  for (const a of recent28) {
    const t = a.startTime.getTime();
    if (t >= weekStart.getTime()) {
      activitiesThisWeek += 1;
      trimpThisWeek += a.trimp ?? 0;
    } else if (t >= lastWeekStart.getTime()) {
      activitiesLastWeek += 1;
      trimpLastWeek += a.trimp ?? 0;
    }
    trimp28d += a.trimp ?? 0;
  }

  // --- Sport mix (28d) ---
  const sportMix: Record<string, number> = {};
  for (const a of recent28) {
    sportMix[a.type] = (sportMix[a.type] ?? 0) + 1;
  }

  // --- HR-zone aggregation across last 28 days ---
  const zoneSeconds = [0, 0, 0, 0, 0];
  let zoneSource: "thresholds" | "hrmax" | "none" = "none";
  if (user) {
    for (const a of recent28) {
      const samples = normalizeHrSamples(a.heartRateData);
      if (!samples || samples.length < 2) continue;
      const zones = computeHrZones(samples, {
        sex: user.sex as "male" | "female" | null,
        birthday: user.birthday,
        maxHeartRate: user.maxHeartRate,
        restHeartRate: user.restHeartRate,
        aerobicThreshold: user.aerobicThreshold,
        anaerobicThreshold: user.anaerobicThreshold,
      });
      if (!zones) continue;
      zoneSource = zones.source;
      for (const z of zones.zones) {
        zoneSeconds[z.index - 1] += z.seconds;
      }
    }
  }
  const totalZoneSec = zoneSeconds.reduce((s, v) => s + v, 0);
  const pct = (i: number) =>
    totalZoneSec > 0 ? Math.round((zoneSeconds[i] / totalZoneSec) * 1000) / 10 : 0;

  // --- Consistency ---
  const activeDays = new Set<string>();
  for (const a of recent28) activeDays.add(dayKey(a.startTime));

  // --- Active goals ---
  const goalRows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.active, true)));

  const goalSnapshots: CoachContext["goals"] = [];
  for (const g of goalRows) {
    const progress = await computeGoalProgress(
      {
        id: g.id,
        userId: g.userId,
        title: g.title,
        metric: g.metric as Goal["metric"],
        activityType: g.activityType,
        timeframe: g.timeframe as Goal["timeframe"],
        targetValue: g.targetValue,
        active: g.active,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      },
      now
    );
    goalSnapshots.push({
      title: g.title,
      metric: g.metric as Goal["metric"],
      timeframe: g.timeframe as Goal["timeframe"],
      activityType: g.activityType,
      targetValue: round1(progress.targetValue),
      currentValue: round1(progress.currentValue),
      progressPct: Math.round(progress.progressPct * 10) / 10,
      daysRemaining: progress.daysRemaining,
      expectedPacePerDay: round1(progress.expectedPacePerDay),
      onPace: progress.deltaPct >= -5,
    });
  }

  // --- Sleep trend (7d / 28d avg score + hours) ---
  const sleepCutoff7 = dayKey(addDays(now, -6));
  const sleepCutoff28 = dayKey(addDays(now, -27));
  const sleepRows = await db
    .select({
      date: sleepSessions.date,
      score: sleepSessions.sleepScore,
      totalSleepSec: sleepSessions.totalSleepSec,
    })
    .from(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, userId),
        gte(sleepSessions.date, sleepCutoff28)
      )
    )
    .orderBy(desc(sleepSessions.date));

  const sleepWindow = (cutoff: string) =>
    sleepRows.filter((r) => r.date >= cutoff);
  const sleepAvg = (rows: typeof sleepRows) => {
    const scored = rows.filter((r) => r.score != null);
    const hoursRows = rows.filter((r) => r.totalSleepSec != null);
    return {
      count: rows.length,
      avgScore:
        scored.length > 0
          ? round1(
              scored.reduce((s, r) => s + (r.score as number), 0) / scored.length
            )
          : null,
      avgHours:
        hoursRows.length > 0
          ? round1(
              hoursRows.reduce((s, r) => s + (r.totalSleepSec as number), 0) /
                hoursRows.length /
                3600
            )
          : null,
    };
  };
  const sleep7 = sleepAvg(sleepWindow(sleepCutoff7));
  const sleep28 = sleepAvg(sleepRows);
  const sleepTrend: CoachContext["sleep"]["trend"] =
    sleep7.avgScore != null && sleep28.avgScore != null
      ? sleep7.avgScore - sleep28.avgScore > 3
        ? "improving"
        : sleep7.avgScore - sleep28.avgScore < -3
          ? "declining"
          : "flat"
      : "unknown";

  // --- Weight trend (latest + delta 7d/28d) ---
  const weightStart = addDays(now, -28);
  weightStart.setHours(0, 0, 0, 0);
  const weightRows = await db
    .select({
      date: weightMeasurements.date,
      weight: weightMeasurements.weight,
    })
    .from(weightMeasurements)
    .where(
      and(
        eq(weightMeasurements.userId, userId),
        gte(weightMeasurements.date, weightStart)
      )
    )
    .orderBy(desc(weightMeasurements.date));

  type WeightRow = (typeof weightRows)[number];
  const weightLatest: WeightRow | null = weightRows[0] ?? null;
  const weightAt = (daysAgo: number): WeightRow | null => {
    const target = addDays(now, -daysAgo).getTime();
    let best: WeightRow | null = null;
    let bestDiff = Infinity;
    for (const r of weightRows) {
      const diff = Math.abs(r.date.getTime() - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = r;
      }
    }
    return best;
  };
  const weight7Ago = weightAt(7);
  const weight28Ago = weightAt(28);
  const weightDelta = (ref: WeightRow | null): number | null =>
    weightLatest && ref && ref !== weightLatest
      ? round1(weightLatest.weight - ref.weight)
      : null;
  const weightLatestDate = weightLatest ? dayKey(weightLatest.date) : null;
  const delta28 = weightDelta(weight28Ago);
  const weightTrendDir: CoachContext["weight"]["trend"] =
    delta28 == null
      ? "unknown"
      : delta28 > 0.3
        ? "up"
        : delta28 < -0.3
          ? "down"
          : "flat";

  // --- Compact last-14d activity list (most recent first, max 20) ---
  const recent14Cutoff = new Date(now);
  recent14Cutoff.setDate(recent14Cutoff.getDate() - 14);
  const recentList = recent28
    .filter((a) => a.startTime >= recent14Cutoff)
    .slice(0, 20)
    .map((a) => ({
      date: dayKey(a.startTime),
      type: a.type,
      durationMin: Math.round((a.movingTime ?? a.duration ?? 0) / 60),
      distanceKm: a.distance != null ? Math.round((a.distance / 1000) * 10) / 10 : null,
      trimp: a.trimp != null ? Math.round(a.trimp * 10) / 10 : null,
      avgHr: a.avgHeartRate ?? null,
      ascentM: a.ascent != null ? Math.round(a.ascent) : null,
    }));

  return {
    today: dayKey(now),
    weekday: WEEKDAYS_DE[now.getDay()],
    user: {
      name: user?.name ?? null,
      sex: (user?.sex as "male" | "female" | null) ?? null,
      age: user?.birthday ? computeAge(user.birthday) : null,
      hrMax: user?.maxHeartRate ?? null,
      hrRest: user?.restHeartRate ?? null,
      hasZoneThresholds:
        !!(user?.aerobicThreshold && user?.anaerobicThreshold),
    },
    trainingLoad: {
      ctl: today.ctl,
      atl: today.atl,
      tsb: today.tsb,
      readiness: computeReadiness(today.tsb),
      zone: zone.id,
      zoneLabel: zone.label,
      ctlDelta7d: round1(today.ctl - d7.ctl),
      ctlDelta28d: round1(today.ctl - d28.ctl),
    },
    recentActivities: recentList,
    weekly: {
      trimpThisWeek: round1(trimpThisWeek),
      trimpLastWeek: round1(trimpLastWeek),
      activitiesThisWeek,
      activitiesLastWeek,
      avgWeeklyTrimp28d: round1(trimp28d / 4),
    },
    sportMix28d: sportMix,
    hrZoneMix28d: {
      z1Pct: pct(0),
      z2Pct: pct(1),
      z3Pct: pct(2),
      z4Pct: pct(3),
      z5Pct: pct(4),
      totalMinutes: Math.round(totalZoneSec / 60),
      source: zoneSource,
    },
    consistency: {
      currentStreakDays: currentStreak(activeDays),
      daysSinceLastActivity: daysSinceLastActive(activeDays),
      activeDaysLast28: activeDays.size,
    },
    goals: goalSnapshots,
    sleep: {
      nights7d: sleep7.count,
      avgScore7d: sleep7.avgScore,
      avgHours7d: sleep7.avgHours,
      nights28d: sleep28.count,
      avgScore28d: sleep28.avgScore,
      avgHours28d: sleep28.avgHours,
      trend: sleepTrend,
    },
    weight: {
      latestKg: weightLatest ? round1(weightLatest.weight) : null,
      latestDate: weightLatestDate,
      delta7dKg: weightDelta(weight7Ago),
      delta28dKg: delta28,
      measurements28d: weightRows.length,
      trend: weightTrendDir,
    },
  };
}

function addDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

/**
 * Stable hash of the coach context. `today` is excluded so an identical
 * training state does not regenerate once per day. The most-recent activity
 * date is already in `recentActivities`, which drives invalidation whenever
 * the user syncs a new workout.
 */
export function computeContextHash(ctx: CoachContext): string {
  const { today: _t, weekday: _w, ...rest } = ctx;
  void _t;
  void _w;
  return createHash("sha256").update(JSON.stringify(rest)).digest("hex");
}

function normalizeHrSamples(raw: unknown): HrSample[] | null {
  if (!Array.isArray(raw)) return null;
  const out: HrSample[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { time?: unknown; bpm?: unknown };
    if (rec.time == null || typeof rec.bpm !== "number") continue;
    if (typeof rec.time !== "string" && !(rec.time instanceof Date)) continue;
    out.push({ time: rec.time, bpm: rec.bpm });
  }
  return out.length >= 2 ? out : null;
}

function computeAge(birthday: Date): number | null {
  const ms = Date.now() - new Date(birthday).getTime();
  const years = ms / (365.25 * 24 * 3600 * 1000);
  if (years < 5 || years > 120) return null;
  return Math.floor(years);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Reference unused type to keep imports tidy in case helpers expand later.
export type _HrZoneRef = HrZone;
