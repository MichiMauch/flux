"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getPhotoCountsByActivity } from "@/lib/activities/photo-counts";

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
  /** Optional — only set on multi-user feeds (e.g. stream). */
  owner?: { id: string; name: string; image: string | null };
  /** Optional — only set on multi-user feeds. */
  boost?: {
    canBoost: boolean;
    boostedByMe: boolean;
    boosters: { id: string; name: string; image: string | null }[];
  };
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

  const where = sport
    ? and(eq(activities.userId, session.user.id), eq(activities.type, sport))
    : eq(activities.userId, session.user.id);

  const rawRows = await db
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
      routeData: sql<unknown>`COALESCE(${activities.routeGeometry}, ${activities.routeData})`,
    })
    .from(activities)
    .where(where)
    .orderBy(desc(activities.startTime))
    .offset(offset)
    .limit(PAGE_SIZE + 1);

  const photoCounts = await getPhotoCountsByActivity(rawRows.map((r) => r.id));
  const rows = rawRows.map((r) => ({
    ...r,
    photoCount: photoCounts.get(r.id) ?? 0,
  }));

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { items, hasMore };
}
