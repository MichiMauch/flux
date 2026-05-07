import { unstable_cache } from "next/cache";
import { and, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { homeCacheTag } from "./home-stats";
import { monthKeyRange } from "@/app/activities/filters";

const TTL_SECONDS = 60 * 30; // 30 min

export interface MonthCount {
  /** "YYYY-MM" */
  key: string;
  count: number;
}

export interface ActivityListRow {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
  duration: number | null;
  movingTime: number | null;
  avgHeartRate: number | null;
  ascent: number | null;
  routeData: unknown;
  photoCount: number;
}

/**
 * Activity month buckets (with counts) for a user, optionally narrowed by
 * sport. Cached because the underlying GROUP BY scans the full table — way
 * too expensive to recompute on every page navigation. Invalidated via the
 * shared `homeCacheTag` (sync, polar webhook, manual edits all already call
 * `revalidateTag(homeCacheTag(userId))`).
 */
export function getActivityMonthCounts(
  userId: string,
  sport: string | null,
): Promise<MonthCount[]> {
  return unstable_cache(
    async () => {
      const where = sport
        ? and(eq(activities.userId, userId), eq(activities.type, sport))
        : eq(activities.userId, userId);
      const rows = await db
        .select({
          key: sql<string>`to_char(${activities.startTime}, 'YYYY-MM')`,
          count: sql<number>`count(*)::int`,
        })
        .from(activities)
        .where(where)
        .groupBy(sql`to_char(${activities.startTime}, 'YYYY-MM')`)
        .orderBy(desc(sql`to_char(${activities.startTime}, 'YYYY-MM')`));
      return rows;
    },
    ["activity-months", userId, sport ?? "all"],
    { tags: [homeCacheTag(userId)], revalidate: TTL_SECONDS },
  )();
}

/**
 * Distinct sport list for a user. Cached for the same reason as the month
 * counts: cheap result, expensive `SELECT DISTINCT` scan, and the set only
 * changes when activities are written.
 */
export function getAvailableSports(userId: string): Promise<string[]> {
  return unstable_cache(
    async () => {
      const rows = await db
        .selectDistinct({ type: activities.type })
        .from(activities)
        .where(eq(activities.userId, userId));
      return rows.map((r) => r.type).sort();
    },
    ["activity-sports", userId],
    { tags: [homeCacheTag(userId)], revalidate: TTL_SECONDS },
  )();
}

/**
 * Single-roundtrip activity-feed query. Photo count is folded into the row
 * via a correlated subquery on the indexed `activity_photos(activity_id)`,
 * so we avoid the separate `getPhotoCountsByActivity` second roundtrip the
 * page used to do.
 */
async function selectActivityRows(
  userId: string,
  sport: string | null,
  monthKey: string | null,
  offset: number,
  limit: number,
): Promise<ActivityListRow[]> {
  const range = monthKeyRange(monthKey);
  const conds: SQL[] = [eq(activities.userId, userId)];
  if (sport) conds.push(eq(activities.type, sport));
  if (range) {
    conds.push(gte(activities.startTime, range.start));
    conds.push(lt(activities.startTime, range.end));
  }
  const where = conds.length === 1 ? conds[0] : and(...conds);

  // List previews only need the simplified ~120-pt polyline, NOT the full
  // GPS track with timestamps. Selecting routeData here makes the rows
  // ~10 MB total which (a) blows past the 2 MB unstable_cache limit and
  // (b) bloats the RSC payload. routeGeometry is the compact preview.
  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      distance: activities.distance,
      duration: activities.duration,
      movingTime: activities.movingTime,
      avgHeartRate: activities.avgHeartRate,
      ascent: activities.ascent,
      routeData: activities.routeGeometry,
      photoCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${activityPhotos} WHERE ${activityPhotos.activityId} = ${activities.id}), 0)`,
    })
    .from(activities)
    .where(where)
    .orderBy(desc(activities.startTime))
    .offset(offset)
    .limit(limit);

  return rows;
}

/**
 * Cached first page of the activities feed. Key includes sport + monthKey,
 * so revisits to a previously-rendered filter are instant. Tagged with the
 * shared `homeCacheTag(userId)`, so sync / edits / webhook still invalidate.
 *
 * Only the first page is cached — `loadMoreActivities` (offset > 0) goes
 * straight to the DB but reuses `fetchActivityRowsUncached` for the same
 * single-roundtrip win.
 */
export function getActivityListPage(
  userId: string,
  sport: string | null,
  monthKey: string | null,
  pageSize: number,
): Promise<ActivityListRow[]> {
  return unstable_cache(
    async () => selectActivityRows(userId, sport, monthKey, 0, pageSize + 1),
    [
      "activity-list-page-0",
      userId,
      sport ?? "all",
      monthKey ?? "all",
      String(pageSize),
    ],
    { tags: [homeCacheTag(userId)], revalidate: TTL_SECONDS },
  )();
}

export const fetchActivityRowsUncached = selectActivityRows;
