"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export interface ActivityFeedItem {
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

export interface LoadMoreResult {
  items: ActivityFeedItem[];
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export async function loadMoreActivities(
  offset: number,
  sport: string | null
): Promise<LoadMoreResult> {
  const session = await auth();
  if (!session?.user?.id) return { items: [], hasMore: false };

  const photoCountSql = sql<number>`(
    SELECT COUNT(*)::int
    FROM ${activityPhotos}
    WHERE ${activityPhotos.activityId} = ${activities.id}
  )`;

  const where = sport
    ? and(eq(activities.userId, session.user.id), eq(activities.type, sport))
    : eq(activities.userId, session.user.id);

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
      routeData: activities.routeData,
      photoCount: photoCountSql,
    })
    .from(activities)
    .where(where)
    .orderBy(desc(activities.startTime))
    .offset(offset)
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { items, hasMore };
}
