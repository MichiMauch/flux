import { unstable_cache } from "next/cache";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
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
        const [row] = await db
          .select({
            total: sql<number>`COALESCE(SUM(${activities.distance}), 0)::float8`,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
              lt(activities.startTime, to),
            ),
          );
        return Number(row?.total ?? 0);
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

      const [totalRow, latest] = await Promise.all([
        db
          .select({
            total: sql<number>`COALESCE(SUM(${activities.ascent}), 0)::float8`,
          })
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
        totalMeters: Math.round(Number(totalRow[0]?.total ?? 0)),
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
        const [row] = await db
          .select({
            total: sql<number>`COALESCE(SUM(COALESCE(${activities.movingTime}, ${activities.duration}, 0)), 0)::float8`,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, from),
              lt(activities.startTime, to),
            ),
          );
        return Math.round(Number(row?.total ?? 0));
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
      // SELECT DISTINCT day_key directly — one row per active day instead
      // of one per activity. For users with multiple activities on the
      // same day, this collapses ~Nx down to # active days.
      const rows = await db
        .selectDistinct({
          day: sql<string>`to_char(${activities.startTime}, 'YYYY-MM-DD')`,
        })
        .from(activities)
        .where(eq(activities.userId, userId));

      const activeDays = new Set<string>(rows.map((r) => r.day));

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

export function getRecordsYtd(userId: string): Promise<RecordsYtdData> {
  return unstable_cache(
    async () => {
      const now = new Date();
      const jan1 = new Date(now.getFullYear(), 0, 1);

      // 4 small parallel queries with ORDER BY metric DESC LIMIT 1 — uses
      // the (user_id, start_time) index for filtering and Postgres picks
      // the single max row per metric. Replaces a full-YTD scan + JS reduce.
      const baseSelect = {
        id: activities.id,
        name: activities.name,
        type: activities.type,
        startTime: activities.startTime,
        distance: activities.distance,
        ascent: activities.ascent,
        avgSpeed: activities.avgSpeed,
        trimp: activities.trimp,
      } as const;
      const where = and(
        eq(activities.userId, userId),
        gte(activities.startTime, jan1),
      );
      // ORDER BY col DESC NULLS LAST — Postgres default for DESC is NULLS
      // FIRST, which would surface a NULL-metric row over a real maximum.
      const topBy = (orderBy: ReturnType<typeof sql>) =>
        db
          .select(baseSelect)
          .from(activities)
          .where(where)
          .orderBy(orderBy)
          .limit(1);

      const [longestRows, highestRows, fastestRows, hardestRows] =
        await Promise.all([
          topBy(sql`${activities.distance} DESC NULLS LAST`),
          topBy(sql`${activities.ascent} DESC NULLS LAST`),
          topBy(sql`${activities.avgSpeed} DESC NULLS LAST`),
          topBy(sql`${activities.trimp} DESC NULLS LAST`),
        ]);

      const toRow = (raw: typeof longestRows): RecordRow | null => {
        const r = raw[0];
        if (!r) return null;
        return {
          id: r.id,
          name: r.name,
          type: r.type,
          startTimeIso: r.startTime.toISOString(),
          distance: r.distance,
          ascent: r.ascent,
          avgSpeed: r.avgSpeed,
          trimp: r.trimp,
        };
      };

      const longest = toRow(longestRows);
      const highest = toRow(highestRows);
      const fastest = toRow(fastestRows);
      const hardest = toRow(hardestRows);

      // ORDER BY DESC puts NULLs last on Postgres by default — but a row
      // with metric=null could still surface if NO row in YTD has the
      // metric. Guard against that by zeroing out null-metric rows.
      const guard = (
        r: RecordRow | null,
        key: "distance" | "ascent" | "avgSpeed" | "trimp",
      ): RecordRow | null => (r && r[key] != null ? r : null);

      return {
        longest: guard(longest, "distance"),
        highest: guard(highest, "ascent"),
        fastest: guard(fastest, "avgSpeed"),
        hardest: guard(hardest, "trimp"),
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
          month: sql<number>`(EXTRACT(MONTH FROM ${activities.startTime})::int - 1)`,
          meters: sql<number>`COALESCE(SUM(${activities.distance}), 0)::float8`,
        })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            gte(activities.startTime, from),
            lt(activities.startTime, to),
          ),
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${activities.startTime})`);

      const km: number[] = Array.from({ length: 12 }, () => 0);
      for (const r of rows) km[Number(r.month)] = Number(r.meters) / 1000;
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
        .select({
          month: sql<number>`(EXTRACT(MONTH FROM ${activities.startTime})::int - 1)`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            gte(activities.startTime, from),
            lt(activities.startTime, to),
          ),
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${activities.startTime})`);

      const counts: number[] = Array.from({ length: 12 }, () => 0);
      for (const r of rows) counts[Number(r.month)] = Number(r.count);
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

      const aggIn = async (rangeFrom: Date, rangeTo: Date) => {
        const [row] = await db
          .select({
            count: sql<number>`COUNT(*)::int`,
            distance: sql<number>`COALESCE(SUM(${activities.distance}), 0)::float8`,
            duration: sql<number>`COALESCE(SUM(COALESCE(${activities.movingTime}, ${activities.duration}, 0)), 0)::float8`,
            ascent: sql<number>`COALESCE(SUM(${activities.ascent}), 0)::float8`,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, rangeFrom),
              lt(activities.startTime, rangeTo),
            ),
          );
        return {
          count: Number(row?.count ?? 0),
          distance: Number(row?.distance ?? 0),
          duration: Number(row?.duration ?? 0),
          ascent: Number(row?.ascent ?? 0),
        };
      };

      const [cur, prev] = await Promise.all([
        aggIn(from, to),
        aggIn(prevFrom, prevTo),
      ]);

      return {
        count: cur.count,
        distance: cur.distance,
        duration: cur.duration,
        ascent: Math.round(cur.ascent),
        prevCount: prev.count,
        prevDistance: prev.distance,
        prevDuration: prev.duration,
        prevAscent: Math.round(prev.ascent),
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

      const aggIn = async (rangeFrom: Date, rangeTo: Date) => {
        const [row] = await db
          .select({
            count: sql<number>`COUNT(*)::int`,
            distance: sql<number>`COALESCE(SUM(${activities.distance}), 0)::float8`,
            duration: sql<number>`COALESCE(SUM(COALESCE(${activities.movingTime}, ${activities.duration}, 0)), 0)::float8`,
            ascent: sql<number>`COALESCE(SUM(${activities.ascent}), 0)::float8`,
          })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.startTime, rangeFrom),
              lt(activities.startTime, rangeTo),
            ),
          );
        return {
          count: Number(row?.count ?? 0),
          distance: Number(row?.distance ?? 0),
          duration: Number(row?.duration ?? 0),
          ascent: Number(row?.ascent ?? 0),
        };
      };

      const [cur, prev] = await Promise.all([
        aggIn(cFrom, cTo),
        aggIn(pFrom, pTo),
      ]);

      return {
        count: cur.count,
        distance: cur.distance,
        duration: cur.duration,
        ascent: Math.round(cur.ascent),
        prevCount: prev.count,
        prevDistance: prev.distance,
        prevDuration: prev.duration,
        prevAscent: Math.round(prev.ascent),
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
