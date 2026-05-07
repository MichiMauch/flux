import { unstable_cache } from "next/cache";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, goals, userTrophies } from "@/lib/db/schema";
import { currentStreak, dayKey, longestStreak } from "@/lib/streak";
import { isoWeek, startOfWeek, currentWeekRange } from "@/lib/activity-week";
import { getDailyTrimp } from "@/lib/training-load-query";
import { computeTrainingLoadSeries } from "@/lib/training-load";
import { computeGoalProgress } from "@/lib/goals-server";
import { computeLevel } from "@/lib/trophies-server";
import type { Goal } from "@/lib/goals";

const TTL_SECONDS = 60 * 30; // 30 min

function tagsFor(userId: string): string[] {
  return [`user:${userId}:home`];
}

function ytdRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getFullYear(), 0, 1), to: now };
}

function lastYearSameRange(now: Date): { from: Date; to: Date } {
  const from = new Date(now.getFullYear() - 1, 0, 1);
  const to = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
  );
  return { from, to };
}

// ── YTD Distance ───────────────────────────────────────────────────────────

export interface YtdDistanceData {
  metersYtd: number;
  metersLastYear: number;
  latestMeters: number | null;
  year: number;
}

export function getYtdDistance(userId: string): Promise<YtdDistanceData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const ytd = ytdRange(now);
      const lastYear = lastYearSameRange(now);

      const sumIn = async (from: Date, to: Date) => {
        const rows = await db
          .select({ distance: activities.distance })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
              lt(activities.startTime, to),
            ),
          );
        return rows.reduce((s, r) => s + (r.distance ?? 0), 0);
      };

      const [metersYtd, metersLastYear, latest] = await Promise.all([
        sumIn(ytd.from, ytd.to),
        sumIn(lastYear.from, lastYear.to),
        db
          .select({ distance: activities.distance })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, ytd.from),
            ),
          )
          .orderBy(desc(activities.startTime))
          .limit(1),
      ]);

      return {
        metersYtd,
        metersLastYear,
        latestMeters: latest[0]?.distance ?? null,
        year: now.getFullYear(),
      };
    },
    ["home:ytd-distance", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── YTD Ascent ─────────────────────────────────────────────────────────────

export interface YtdAscentData {
  totalMeters: number;
  latestAscent: number | null;
  year: number;
}

export function getYtdAscent(userId: string): Promise<YtdAscentData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const { from, to } = ytdRange(now);

      const [rows, latest] = await Promise.all([
        db
          .select({ ascent: activities.ascent })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
              lt(activities.startTime, to),
            ),
          ),
        db
          .select({ ascent: activities.ascent })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
            ),
          )
          .orderBy(desc(activities.startTime))
          .limit(1),
      ]);

      return {
        totalMeters: Math.round(
          rows.reduce((s, r) => s + (r.ascent ?? 0), 0),
        ),
        latestAscent:
          latest[0]?.ascent != null ? Math.round(latest[0].ascent) : null,
        year: now.getFullYear(),
      };
    },
    ["home:ytd-ascent", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── YTD Time ───────────────────────────────────────────────────────────────

export interface YtdTimeData {
  secYtd: number;
  secLastYear: number;
  latestSec: number | null;
  year: number;
}

export function getYtdTime(userId: string): Promise<YtdTimeData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const ytd = ytdRange(now);
      const lastYear = lastYearSameRange(now);

      const sumIn = async (from: Date, to: Date) => {
        const rows = await db
          .select({
            duration: activities.duration,
            movingTime: activities.movingTime,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
              lt(activities.startTime, to),
            ),
          );
        return rows.reduce(
          (s, r) => s + (r.movingTime ?? r.duration ?? 0),
          0,
        );
      };

      const [secYtd, secLastYear, latest] = await Promise.all([
        sumIn(ytd.from, ytd.to),
        sumIn(lastYear.from, lastYear.to),
        db
          .select({
            duration: activities.duration,
            movingTime: activities.movingTime,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, ytd.from),
            ),
          )
          .orderBy(desc(activities.startTime))
          .limit(1),
      ]);

      return {
        secYtd,
        secLastYear,
        latestSec: latest[0]?.movingTime ?? latest[0]?.duration ?? null,
        year: now.getFullYear(),
      };
    },
    ["home:ytd-time", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Sports YTD ─────────────────────────────────────────────────────────────

export interface SportsYtdData {
  types: string[];
  year: number;
}

export function getSportsYtd(userId: string): Promise<SportsYtdData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear() + 1, 0, 1);

      const rows = await db
        .select({ type: activities.type })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            gte(activities.startTime, from),
            lt(activities.startTime, to),
          ),
        );

      return { types: rows.map((r) => r.type), year: now.getFullYear() };
    },
    ["home:sports-ytd", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Streak ─────────────────────────────────────────────────────────────────

export interface StreakData {
  current: number;
  longest: number;
}

export function getStreak(userId: string): Promise<StreakData> {
  return unstable_cache(
    async () => {
      const acts = await db
        .select({ startTime: activities.startTime })
        .from(activities)
        .where(eq(activities.userId, userId))
        .orderBy(desc(activities.startTime));

      const activeDays = new Set<string>();
      for (const a of acts) activeDays.add(dayKey(a.startTime));

      return {
        current: currentStreak(activeDays),
        longest: longestStreak(activeDays),
      };
    },
    ["home:streak", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Consistency 12w ────────────────────────────────────────────────────────

export interface ConsistencyData {
  daysSinceLast: number | null;
  activeCount: number;
  daysYtd: number;
  weeks: { start: string; count: number; week: number }[];
  weekNo: number;
}

export function getConsistency(userId: string): Promise<ConsistencyData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);

      const rows = await db
        .select({ startTime: activities.startTime })
        .from(activities)
        .where(
          and(eq(activities.userId, userId), gte(activities.startTime, jan1)),
        );

      const activeDays = new Set<string>();
      let latest: Date | null = null;
      for (const r of rows) {
        activeDays.add(dayKey(r.startTime));
        if (!latest || r.startTime.getTime() > latest.getTime())
          latest = r.startTime;
      }

      const daysBetween = (a: Date, b: Date): number => {
        const dayMs = 86400000;
        const da = new Date(
          a.getFullYear(),
          a.getMonth(),
          a.getDate(),
        ).getTime();
        const db2 = new Date(
          b.getFullYear(),
          b.getMonth(),
          b.getDate(),
        ).getTime();
        return Math.round((da - db2) / dayMs);
      };

      const daysSinceLast = latest ? daysBetween(now, latest) : null;
      const daysYtd = daysBetween(now, jan1) + 1;
      const activeCount = activeDays.size;

      const WEEKS = 12;
      const weekStarts: Date[] = [];
      for (let i = WEEKS - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        weekStarts.push(startOfWeek(d));
      }
      const weeks = weekStarts.map((ws) => {
        const weekEnd = new Date(ws);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const count = rows.filter(
          (r) => r.startTime >= ws && r.startTime < weekEnd,
        ).length;
        return {
          start: ws.toISOString(),
          count,
          week: isoWeek(ws),
        };
      });

      return {
        daysSinceLast,
        activeCount,
        daysYtd,
        weeks,
        weekNo: isoWeek(now),
      };
    },
    ["home:consistency", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Records YTD ────────────────────────────────────────────────────────────

export interface RecordRow {
  id: string;
  name: string;
  type: string;
  startTimeIso: string;
  distance: number | null;
  ascent: number | null;
  avgSpeed: number | null;
  trimp: number | null;
}

export interface RecordsYtdData {
  longest: RecordRow | null;
  highest: RecordRow | null;
  fastest: RecordRow | null;
  hardest: RecordRow | null;
  year: number;
}

function pickMax(
  rows: RecordRow[],
  key: "distance" | "ascent" | "avgSpeed" | "trimp",
): RecordRow | null {
  let best: RecordRow | null = null;
  let bestVal = -Infinity;
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    if (v > bestVal) {
      bestVal = v;
      best = r;
    }
  }
  return best;
}

export function getRecordsYtd(userId: string): Promise<RecordsYtdData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);

      const raw = await db
        .select({
          id: activities.id,
          name: activities.name,
          type: activities.type,
          startTime: activities.startTime,
          distance: activities.distance,
          ascent: activities.ascent,
          avgSpeed: activities.avgSpeed,
          trimp: activities.trimp,
        })
        .from(activities)
        .where(
          and(eq(activities.userId, userId), gte(activities.startTime, jan1)),
        );

      const rows: RecordRow[] = raw.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        startTimeIso: r.startTime.toISOString(),
        distance: r.distance,
        ascent: r.ascent,
        avgSpeed: r.avgSpeed,
        trimp: r.trimp,
      }));

      return {
        longest: pickMax(rows, "distance"),
        highest: pickMax(rows, "ascent"),
        fastest: pickMax(rows, "avgSpeed"),
        hardest: pickMax(rows, "trimp"),
        year: now.getFullYear(),
      };
    },
    ["home:records-ytd", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Monthly km ─────────────────────────────────────────────────────────────

export interface MonthlyKmData {
  km: number[];
  totalKm: number;
  currentMonth: number;
}

export function getMonthlyKm(userId: string): Promise<MonthlyKmData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const year = now.getFullYear();
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);

      const rows = await db
        .select({
          startTime: activities.startTime,
          distance: activities.distance,
        })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            gte(activities.startTime, from),
            lt(activities.startTime, to),
          ),
        );

      const km: number[] = Array.from({ length: 12 }, () => 0);
      for (const a of rows)
        km[a.startTime.getMonth()] += (a.distance ?? 0) / 1000;
      const totalKm = km.reduce((s, v) => s + v, 0);

      return { km, totalKm, currentMonth: now.getMonth() };
    },
    ["home:monthly-km", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Monthly activities ─────────────────────────────────────────────────────

export interface MonthlyActivitiesData {
  counts: number[];
  total: number;
  currentMonth: number;
}

export function getMonthlyActivities(
  userId: string,
): Promise<MonthlyActivitiesData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const year = now.getFullYear();
      const from = new Date(year, 0, 1);
      const to = new Date(year + 1, 0, 1);

      const rows = await db
        .select({ startTime: activities.startTime })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            gte(activities.startTime, from),
            lt(activities.startTime, to),
          ),
        );

      const counts: number[] = Array.from({ length: 12 }, () => 0);
      for (const a of rows) counts[a.startTime.getMonth()] += 1;
      const total = counts.reduce((s, v) => s + v, 0);

      return { counts, total, currentMonth: now.getMonth() };
    },
    ["home:monthly-activities", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Form (CTL/ATL/TSB) ─────────────────────────────────────────────────────

export interface FormData {
  series: import("@/lib/training-load").TrainingLoadPoint[];
  hasData: boolean;
  visibleDays: number;
}

export function getForm(userId: string): Promise<FormData> {
  return unstable_cache(
    async () => {
      const visibleDays = 30;
      const preRoll = 42;

      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const visibleStart = new Date(end);
      visibleStart.setDate(visibleStart.getDate() - (visibleDays - 1));
      visibleStart.setHours(0, 0, 0, 0);
      const computeStart = new Date(visibleStart);
      computeStart.setDate(computeStart.getDate() - preRoll);

      const daily = await getDailyTrimp(userId, computeStart, end);
      const full = computeTrainingLoadSeries(daily, computeStart, end);
      const series = full.slice(preRoll);

      return {
        series,
        hasData: daily.size > 0 && series.length > 0,
        visibleDays,
      };
    },
    ["home:form", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Weekly Stats ───────────────────────────────────────────────────────────

export interface WeeklyStatsData {
  count: number;
  distance: number;
  duration: number;
  ascent: number;
  prevCount: number;
  prevDistance: number;
  prevDuration: number;
  prevAscent: number;
  weekNo: number;
}

export function getWeeklyStats(userId: string): Promise<WeeklyStatsData> {
  return unstable_cache(
    async () => {
      const { from, to } = currentWeekRange();
      const prevFrom = new Date(from);
      prevFrom.setDate(prevFrom.getDate() - 7);
      const prevTo = from;

      const sel = (rangeFrom: Date, rangeTo: Date) =>
        db
          .select({
            distance: activities.distance,
            duration: activities.duration,
            movingTime: activities.movingTime,
            ascent: activities.ascent,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, rangeFrom),
              lt(activities.startTime, rangeTo),
            ),
          );

      const [rows, prevRows] = await Promise.all([sel(from, to), sel(prevFrom, prevTo)]);

      const sum = (rs: typeof rows, key: "distance" | "ascent") =>
        rs.reduce((s, r) => s + (r[key] ?? 0), 0);
      const sumDur = (rs: typeof rows) =>
        rs.reduce((s, r) => s + (r.movingTime ?? r.duration ?? 0), 0);

      return {
        count: rows.length,
        distance: sum(rows, "distance"),
        duration: sumDur(rows),
        ascent: Math.round(sum(rows, "ascent")),
        prevCount: prevRows.length,
        prevDistance: sum(prevRows, "distance"),
        prevDuration: sumDur(prevRows),
        prevAscent: Math.round(sum(prevRows, "ascent")),
        weekNo: isoWeek(from),
      };
    },
    ["home:weekly-stats", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Monthly Stats ──────────────────────────────────────────────────────────

export interface MonthlyStatsData {
  count: number;
  distance: number;
  duration: number;
  ascent: number;
  prevCount: number;
  prevDistance: number;
  prevDuration: number;
  prevAscent: number;
  currentMonth: number;
}

export function getMonthlyStats(userId: string): Promise<MonthlyStatsData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const cFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      const cTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const pFrom = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      const pTo = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);

      const sel = (rangeFrom: Date, rangeTo: Date) =>
        db
          .select({
            distance: activities.distance,
            duration: activities.duration,
            movingTime: activities.movingTime,
            ascent: activities.ascent,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, rangeFrom),
              lt(activities.startTime, rangeTo),
            ),
          );

      const [rows, prevRows] = await Promise.all([sel(cFrom, cTo), sel(pFrom, pTo)]);

      const sum = (rs: typeof rows, key: "distance" | "ascent") =>
        rs.reduce((s, r) => s + (r[key] ?? 0), 0);
      const sumDur = (rs: typeof rows) =>
        rs.reduce((s, r) => s + (r.movingTime ?? r.duration ?? 0), 0);

      return {
        count: rows.length,
        distance: sum(rows, "distance"),
        duration: sumDur(rows),
        ascent: Math.round(sum(rows, "ascent")),
        prevCount: prevRows.length,
        prevDistance: sum(prevRows, "distance"),
        prevDuration: sumDur(prevRows),
        prevAscent: Math.round(sum(prevRows, "ascent")),
        currentMonth: now.getMonth(),
      };
    },
    ["home:monthly-stats", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Goals Progress ─────────────────────────────────────────────────────────

export interface GoalWithProgress {
  goal: Goal;
  progress: Awaited<ReturnType<typeof computeGoalProgress>>;
}

export function getGoalsProgress(userId: string): Promise<GoalWithProgress[]> {
  return unstable_cache(
    async () => {
      const rows = await db
        .select()
        .from(goals)
        .where(eq(goals.userId, userId))
        .orderBy(desc(goals.createdAt));

      const withProgress = await Promise.all(
        rows.map(async (g) => ({
          goal: g as Goal,
          progress: await computeGoalProgress(g as Goal),
        })),
      );

      withProgress.sort((a, b) => {
        const aBehind = a.progress.deltaPct < 0 ? 1 : 0;
        const bBehind = b.progress.deltaPct < 0 ? 1 : 0;
        if (aBehind !== bBehind) return bBehind - aBehind;
        return b.progress.progressPct - a.progress.progressPct;
      });

      return withProgress;
    },
    ["home:goals-progress", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Level + Trophies ───────────────────────────────────────────────────────

export interface LevelTrophiesData {
  level: Awaited<ReturnType<typeof computeLevel>>;
  trophies: { code: string; unlockedAtIso: string }[];
}

export function getLevelTrophies(userId: string): Promise<LevelTrophiesData> {
  return unstable_cache(
    async () => {
      const [level, trophyRows] = await Promise.all([
        computeLevel(userId),
        db
          .select({
            code: userTrophies.trophyCode,
            unlockedAt: userTrophies.unlockedAt,
          })
          .from(userTrophies)
          .where(eq(userTrophies.userId, userId))
          .orderBy(desc(userTrophies.unlockedAt)),
      ]);

      return {
        level,
        trophies: trophyRows.map((r) => ({
          code: r.code,
          unlockedAtIso: r.unlockedAt.toISOString(),
        })),
      };
    },
    ["home:level-trophies", userId],
    { revalidate: TTL_SECONDS, tags: tagsFor(userId) },
  )();
}

// ── Invalidation ───────────────────────────────────────────────────────────

/**
 * Invalidate all home-page caches for the given user. Call this from any
 * write path that touches activities, goals, or trophies.
 */
export function homeCacheTag(userId: string): string {
  return `user:${userId}:home`;
}
