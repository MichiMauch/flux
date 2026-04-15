import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  userTrophies,
  pendingUnlocks,
} from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import {
  TROPHIES,
  type TrophyDef,
  type Criterion,
  activityXp,
  levelFromXp,
} from "./trophies";

interface ActivityLite {
  id: string;
  startTime: Date;
  distance: number | null;
  ascent: number | null;
  duration: number | null;
  movingTime: number | null;
  trimp: number | null;
}

async function loadAllActivities(userId: string): Promise<ActivityLite[]> {
  return await db
    .select({
      id: activities.id,
      startTime: activities.startTime,
      distance: activities.distance,
      ascent: activities.ascent,
      duration: activities.duration,
      movingTime: activities.movingTime,
      trimp: activities.trimp,
    })
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.startTime));
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
      const hour = a.startTime.getHours();
      if (c.beforeHour !== undefined && hour < c.beforeHour) return a;
      if (c.afterHour !== undefined && hour >= c.afterHour) return a;
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
  acts: ActivityLite[]
): TrophyProgress | null {
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
  acts: ActivityLite[]
): { met: boolean; activityId: string | null } {
  const c = def.criterion;
  if (c.kind === "single_activity" || c.kind === "single_activity_time") {
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
  const [acts, alreadyRows] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({ code: userTrophies.trophyCode })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
  ]);
  const already = new Set(alreadyRows.map((r) => r.code));

  const newlyUnlocked: string[] = [];
  for (const def of TROPHIES) {
    if (already.has(def.code)) continue;
    const { met, activityId: matchedActivityId } = isCriterionMet(def, acts);
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
  const [acts, unlockedRows] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({
        code: userTrophies.trophyCode,
        unlockedAt: userTrophies.unlockedAt,
      })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
  ]);
  const unlocked = new Map(unlockedRows.map((r) => [r.code, r.unlockedAt]));
  return TROPHIES.map((def) => {
    const progress = criterionProgress(def.criterion, acts);
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
