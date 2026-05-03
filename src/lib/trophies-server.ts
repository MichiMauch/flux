import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityBoosts,
  userTrophies,
  pendingUnlocks,
} from "@/lib/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  TROPHIES,
  type TrophyDef,
  type Criterion,
  activityXp,
  levelFromXp,
} from "./trophies";
import type { WeatherData } from "./weather";

interface ActivityLite {
  id: string;
  startTime: Date;
  distance: number | null;
  ascent: number | null;
  duration: number | null;
  movingTime: number | null;
  trimp: number | null;
  weather: WeatherData | null;
}

async function loadAllActivities(userId: string): Promise<ActivityLite[]> {
  const rows = await db
    .select({
      id: activities.id,
      startTime: activities.startTime,
      distance: activities.distance,
      ascent: activities.ascent,
      duration: activities.duration,
      movingTime: activities.movingTime,
      trimp: activities.trimp,
      weather: activities.weather,
    })
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.startTime));
  return rows.map((r) => ({
    ...r,
    weather: (r.weather as WeatherData | null) ?? null,
  }));
}

async function loadBoostCount(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(activityBoosts)
    .where(eq(activityBoosts.userId, userId));
  return rows[0]?.c ?? 0;
}

function activityDistanceKm(a: ActivityLite) {
  return (a.distance ?? 0) / 1000;
}
function activityDurationH(a: ActivityLite) {
  return (a.movingTime ?? a.duration ?? 0) / 3600;
}
function activityAscentM(a: ActivityLite) {
  return a.ascent ?? 0;
}

function matchesSingle(def: TrophyDef, acts: ActivityLite[]): ActivityLite | null {
  const c = def.criterion;
  for (const a of acts) {
    if (c.kind === "single_activity") {
      const v =
        c.metric === "distance_km"
          ? activityDistanceKm(a)
          : c.metric === "ascent_m"
            ? activityAscentM(a)
            : activityDurationH(a);
      if (v >= c.threshold) return a;
    } else if (c.kind === "single_activity_time") {
      if (c.weekdays && !c.weekdays.includes(a.startTime.getDay())) continue;
      const hourFrac =
        a.startTime.getHours() + a.startTime.getMinutes() / 60;
      if (c.beforeHour !== undefined && hourFrac < c.beforeHour) return a;
      if (c.afterHour !== undefined && hourFrac >= c.afterHour) return a;
      if (
        c.betweenHourFrom !== undefined &&
        c.betweenHourTo !== undefined &&
        hourFrac >= c.betweenHourFrom &&
        hourFrac <= c.betweenHourTo
      ) {
        return a;
      }
    } else if (c.kind === "single_activity_combined") {
      const ascent = a.ascent ?? 0;
      const distKm = (a.distance ?? 0) / 1000;
      if (ascent >= c.ascentMin && distKm < c.distanceMaxKm) return a;
    } else if (c.kind === "weather_condition") {
      const w = a.weather;
      if (!w) continue;
      let ok = true;
      if (c.rain) {
        const desc = w.description ?? "";
        // Open-Meteo schreibt deutsche WMO-Beschreibungen ("Regen", "Leichter Regen",
        // "Regenschauer", "Nieselregen") — englische Begriffe als Fallback.
        if (!/regen|schauer|niesel|drizzle|rain|shower/i.test(desc)) ok = false;
      }
      if (c.tempBelow !== undefined) {
        if (typeof w.temp !== "number" || w.temp >= c.tempBelow) ok = false;
      }
      if (ok) return a;
    } else if (c.kind === "round_finish") {
      const dur = a.duration ?? 0;
      const distM = a.distance ?? 0;
      if (dur > 0) {
        const modSec = dur % 3600;
        if (
          modSec <= c.durationToleranceSec ||
          3600 - modSec <= c.durationToleranceSec
        ) {
          return a;
        }
      }
      if (distM > 0) {
        for (const km of c.roundKmSteps) {
          if (Math.abs(distM - km * 1000) <= c.distanceToleranceM) return a;
        }
      }
    }
  }
  return null;
}

function comebackHit(
  thresholdDays: number,
  acts: ActivityLite[]
): ActivityLite | null {
  if (acts.length < 2) return null;
  // acts kommt DESC sortiert — für Lücken-Suche ASC sortieren.
  const asc = [...acts].sort(
    (x, y) => x.startTime.getTime() - y.startTime.getTime()
  );
  const ms = thresholdDays * 24 * 3600 * 1000;
  for (let i = 1; i < asc.length; i++) {
    if (asc[i].startTime.getTime() - asc[i - 1].startTime.getTime() >= ms) {
      return asc[i];
    }
  }
  return null;
}

function lifetimeValue(
  metric: "distance_km" | "ascent_m" | "duration_h" | "count",
  acts: ActivityLite[]
): number {
  if (metric === "count") return acts.length;
  let sum = 0;
  for (const a of acts) {
    sum +=
      metric === "distance_km"
        ? activityDistanceKm(a)
        : metric === "ascent_m"
          ? activityAscentM(a)
          : activityDurationH(a);
  }
  return sum;
}

function longestStreakDays(acts: ActivityLite[]): number {
  if (acts.length === 0) return 0;
  const days = new Set<string>();
  for (const a of acts) {
    const d = a.startTime;
    days.add(
      `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    );
  }
  const sorted = Array.from(days)
    .map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);
  const DAY = 24 * 3600 * 1000;
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === DAY) {
      cur += 1;
      if (cur > longest) longest = cur;
    } else if (sorted[i] !== sorted[i - 1]) {
      cur = 1;
    }
  }
  return longest;
}

function weekdayCount(weekday: number, acts: ActivityLite[]): number {
  return acts.filter((a) => a.startTime.getDay() === weekday).length;
}

export interface TrophyProgress {
  code: string;
  currentValue: number;
  targetValue: number;
  progressPct: number;
  unit: "km" | "m" | "h" | "";
}

function criterionProgress(
  c: Criterion,
  acts: ActivityLite[],
  boostCount: number
): TrophyProgress | null {
  if (c.kind === "boosts_given") {
    const v = boostCount;
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "lifetime_sum") {
    const v = lifetimeValue(c.metric, acts);
    const unit =
      c.metric === "distance_km" ? "km" : c.metric === "ascent_m" ? "m" : "h";
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit,
    };
  }
  if (c.kind === "lifetime_count") {
    const v = acts.length;
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "streak_days") {
    const v = longestStreakDays(acts);
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "weekday_count") {
    const v = weekdayCount(c.weekday, acts);
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "single_activity") {
    let best = 0;
    for (const a of acts) {
      const v =
        c.metric === "distance_km"
          ? activityDistanceKm(a)
          : c.metric === "ascent_m"
            ? activityAscentM(a)
            : activityDurationH(a);
      if (v > best) best = v;
    }
    const unit =
      c.metric === "distance_km" ? "km" : c.metric === "ascent_m" ? "m" : "h";
    return {
      code: "",
      currentValue: best,
      targetValue: c.threshold,
      progressPct: Math.min(100, (best / c.threshold) * 100),
      unit,
    };
  }
  // single_activity_time has no meaningful progress
  return null;
}

function isCriterionMet(
  def: TrophyDef,
  acts: ActivityLite[],
  boostCount: number
): { met: boolean; activityId: string | null } {
  const c = def.criterion;
  if (
    c.kind === "single_activity" ||
    c.kind === "single_activity_time" ||
    c.kind === "single_activity_combined" ||
    c.kind === "weather_condition" ||
    c.kind === "round_finish"
  ) {
    const a = matchesSingle(def, acts);
    return { met: !!a, activityId: a?.id ?? null };
  }
  if (c.kind === "lifetime_sum") {
    return { met: lifetimeValue(c.metric, acts) >= c.threshold, activityId: null };
  }
  if (c.kind === "lifetime_count") {
    return { met: acts.length >= c.threshold, activityId: null };
  }
  if (c.kind === "streak_days") {
    return {
      met: longestStreakDays(acts) >= c.threshold,
      activityId: null,
    };
  }
  if (c.kind === "weekday_count") {
    return {
      met: weekdayCount(c.weekday, acts) >= c.threshold,
      activityId: null,
    };
  }
  if (c.kind === "comeback_days") {
    const a = comebackHit(c.threshold, acts);
    return { met: !!a, activityId: a?.id ?? null };
  }
  if (c.kind === "boosts_given") {
    return { met: boostCount >= c.threshold, activityId: null };
  }
  return { met: false, activityId: null };
}

/**
 * Evaluate all trophies for a user against their current activities.
 * Inserts new unlocks into user_trophies and pending_unlocks (idempotent).
 * Returns the list of newly unlocked trophy codes.
 */
export async function evaluateTrophies(
  userId: string,
  activityId?: string
): Promise<string[]> {
  const [acts, alreadyRows, boostCount] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({ code: userTrophies.trophyCode })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
    loadBoostCount(userId),
  ]);
  const already = new Set(alreadyRows.map((r) => r.code));

  const newlyUnlocked: string[] = [];
  for (const def of TROPHIES) {
    if (already.has(def.code)) continue;
    const { met, activityId: matchedActivityId } = isCriterionMet(
      def,
      acts,
      boostCount
    );
    if (!met) continue;
    await db.insert(userTrophies).values({
      userId,
      trophyCode: def.code,
      activityId: matchedActivityId ?? activityId ?? null,
    });
    await db.insert(pendingUnlocks).values({
      userId,
      trophyCode: def.code,
    });
    newlyUnlocked.push(def.code);
  }
  return newlyUnlocked;
}

export async function computeLevel(userId: string) {
  const acts = await loadAllActivities(userId);
  let xp = 0;
  for (const a of acts) xp += activityXp(a);
  return { ...levelFromXp(xp), totalXp: xp };
}

/**
 * Compute trophy progress for all trophies (locked + unlocked) for a user.
 */
export async function loadTrophyState(userId: string) {
  const [acts, unlockedRows, boostCount] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({
        code: userTrophies.trophyCode,
        unlockedAt: userTrophies.unlockedAt,
      })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
    loadBoostCount(userId),
  ]);
  const unlocked = new Map(unlockedRows.map((r) => [r.code, r.unlockedAt]));
  return TROPHIES.map((def) => {
    const progress = criterionProgress(def.criterion, acts, boostCount);
    const unlockedAt = unlocked.get(def.code) ?? null;
    return {
      def,
      unlockedAt,
      progress: progress
        ? { ...progress, code: def.code }
        : null,
    };
  });
}

export async function listPendingUnlocks(userId: string) {
  return await db
    .select()
    .from(pendingUnlocks)
    .where(eq(pendingUnlocks.userId, userId))
    .orderBy(desc(pendingUnlocks.createdAt));
}

export async function ackPendingUnlocks(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  for (const id of ids) {
    await db
      .delete(pendingUnlocks)
      .where(and(eq(pendingUnlocks.userId, userId), eq(pendingUnlocks.id, id)));
  }
}

export async function getRecentTrophies(userId: string, limit = 3) {
  return await db
    .select({
      code: userTrophies.trophyCode,
      unlockedAt: userTrophies.unlockedAt,
    })
    .from(userTrophies)
    .where(eq(userTrophies.userId, userId))
    .orderBy(desc(userTrophies.unlockedAt))
    .limit(limit);
}
