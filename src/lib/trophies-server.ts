import "server-only";
import { db } from "@/lib/db";
import {
  activities,
  activityBoosts,
  users,
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
  type: string;
  locality: string | null;
  country: string | null;
  startLat: number | null;
  startLng: number | null;
}

interface EvalContext {
  acts: ActivityLite[];
  partnerActs: ActivityLite[];
  boostCount: number;
}

async function loadActivitiesFor(userId: string): Promise<ActivityLite[]> {
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
      type: activities.type,
      locality: activities.locality,
      country: activities.country,
      startLat: sql<number | null>`(${activities.routeData}->0->>'lat')::float`,
      startLng: sql<number | null>`(${activities.routeData}->0->>'lng')::float`,
    })
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.startTime));
  return rows.map((r) => ({
    ...r,
    weather: (r.weather as WeatherData | null) ?? null,
  }));
}

async function loadAllActivities(userId: string): Promise<ActivityLite[]> {
  return loadActivitiesFor(userId);
}

async function loadPartnerId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0]?.partnerId ?? null;
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

function distinctLocalities(acts: ActivityLite[]): number {
  const set = new Set<string>();
  for (const a of acts) if (a.locality) set.add(a.locality);
  return set.size;
}

function distinctCountries(acts: ActivityLite[]): number {
  const set = new Set<string>();
  for (const a of acts) if (a.country) set.add(a.country);
  return set.size;
}

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sliding window: gibt es einen Zeitraum von windowDays, in dem mindestens
 * `threshold` PB-Setter-Activities liegen? PB-Definition: erstmaliger Bestwert
 * (>) pro (Sportart × Metrik) mit Metriken {distance, avgSpeedKmh, ascent,
 * duration}. Erste Activity einer Sportart zählt nicht (keine Baseline).
 * Liefert die Activity, die das Limit *innerhalb* des Fensters reisst.
 */
function pbsInWindowHit(
  acts: ActivityLite[],
  windowDays: number,
  threshold: number
): { hit: boolean; activityId: string | null } {
  if (acts.length < threshold) return { hit: false, activityId: null };
  const asc = [...acts].sort(
    (x, y) => x.startTime.getTime() - y.startTime.getTime()
  );
  const best = new Map<string, number>();
  const pbs: { id: string; t: number }[] = [];
  for (const a of asc) {
    if (!a.type) continue;
    const dist = a.distance ?? 0;
    const moving = a.movingTime ?? a.duration ?? 0;
    const speedKmh =
      dist > 0 && moving > 0 ? dist / 1000 / (moving / 3600) : 0;
    const ascent = a.ascent ?? 0;
    const duration = a.duration ?? 0;
    const candidates: { metric: string; value: number }[] = [
      { metric: "distance", value: dist },
      { metric: "avgSpeedKmh", value: speedKmh },
      { metric: "ascent", value: ascent },
      { metric: "duration", value: duration },
    ];
    let setNewPb = false;
    for (const { metric, value } of candidates) {
      if (value <= 0) continue;
      const key = `${a.type}:${metric}`;
      const prev = best.get(key);
      if (prev === undefined) {
        best.set(key, value);
      } else if (value > prev) {
        best.set(key, value);
        setNewPb = true;
      }
    }
    if (setNewPb) pbs.push({ id: a.id, t: a.startTime.getTime() });
  }
  const ms = windowDays * 24 * 3600 * 1000;
  for (let i = 0; i + threshold - 1 < pbs.length; i++) {
    const last = pbs[i + threshold - 1];
    if (last.t - pbs[i].t <= ms) {
      return { hit: true, activityId: last.id };
    }
  }
  return { hit: false, activityId: null };
}

/**
 * Zählt gemeinsame Activities mit dem Partner: Start-Zeit-Differenz ≤ 10 Min
 * UND Start-Koordinate (haversine) ≤ 500 m. Eine Partner-Activity wird nur
 * einmal gematcht.
 */
function coActivityCount(
  myActs: ActivityLite[],
  partnerActs: ActivityLite[]
): { count: number; activityId: string | null } {
  if (partnerActs.length === 0) return { count: 0, activityId: null };
  const TIME_MS = 600 * 1000;
  const RADIUS_M = 500;
  const myAsc = [...myActs].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const partnerAsc = [...partnerActs].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );
  const matched = new Set<string>();
  let count = 0;
  let lastId: string | null = null;
  for (const a of myAsc) {
    if (a.startLat == null || a.startLng == null) continue;
    for (const p of partnerAsc) {
      if (matched.has(p.id)) continue;
      const dt = Math.abs(a.startTime.getTime() - p.startTime.getTime());
      if (dt > TIME_MS) continue;
      if (p.startLat == null || p.startLng == null) continue;
      const d = haversineMeters(a.startLat, a.startLng, p.startLat, p.startLng);
      if (d <= RADIUS_M) {
        matched.add(p.id);
        count++;
        lastId = a.id;
        break;
      }
    }
  }
  return { count, activityId: lastId };
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
  ctx: EvalContext
): TrophyProgress | null {
  const { acts, partnerActs, boostCount } = ctx;
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
  if (c.kind === "distinct_localities") {
    const v = distinctLocalities(acts);
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "distinct_countries") {
    const v = distinctCountries(acts);
    return {
      code: "",
      currentValue: v,
      targetValue: c.threshold,
      progressPct: Math.min(100, (v / c.threshold) * 100),
      unit: "",
    };
  }
  if (c.kind === "co_activity_count") {
    const v = coActivityCount(acts, partnerActs).count;
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
  ctx: EvalContext
): { met: boolean; activityId: string | null } {
  const c = def.criterion;
  const { acts, partnerActs, boostCount } = ctx;
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
  if (c.kind === "distinct_localities") {
    return {
      met: distinctLocalities(acts) >= c.threshold,
      activityId: null,
    };
  }
  if (c.kind === "distinct_countries") {
    return {
      met: distinctCountries(acts) >= c.threshold,
      activityId: null,
    };
  }
  if (c.kind === "pbs_in_window") {
    const r = pbsInWindowHit(acts, c.windowDays, c.threshold);
    return { met: r.hit, activityId: r.activityId };
  }
  if (c.kind === "co_activity_count") {
    const r = coActivityCount(acts, partnerActs);
    return { met: r.count >= c.threshold, activityId: r.activityId };
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
  const [acts, alreadyRows, boostCount, partnerId] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({ code: userTrophies.trophyCode })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
    loadBoostCount(userId),
    loadPartnerId(userId),
  ]);
  const partnerActs = partnerId ? await loadActivitiesFor(partnerId) : [];
  const ctx: EvalContext = { acts, partnerActs, boostCount };
  const already = new Set(alreadyRows.map((r) => r.code));

  const newlyUnlocked: string[] = [];
  for (const def of TROPHIES) {
    if (already.has(def.code)) continue;
    const { met, activityId: matchedActivityId } = isCriterionMet(def, ctx);
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
  const [acts, unlockedRows, boostCount, partnerId] = await Promise.all([
    loadAllActivities(userId),
    db
      .select({
        code: userTrophies.trophyCode,
        unlockedAt: userTrophies.unlockedAt,
      })
      .from(userTrophies)
      .where(eq(userTrophies.userId, userId)),
    loadBoostCount(userId),
    loadPartnerId(userId),
  ]);
  const partnerActs = partnerId ? await loadActivitiesFor(partnerId) : [];
  const ctx: EvalContext = { acts, partnerActs, boostCount };
  const unlocked = new Map(unlockedRows.map((r) => [r.code, r.unlockedAt]));
  return TROPHIES.map((def) => {
    const progress = criterionProgress(def.criterion, ctx);
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
