"use server";

import { auth } from "@/auth";
import { fetchActivityRowsUncached } from "@/lib/cache/activity-filters";

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

const PAGE_SIZE = 15;

export async function loadMoreActivities(
  offset: number,
  sport: string | null,
  monthKey: string | null = null,
): Promise<LoadMoreResult> {
  const session = await auth();
  if (!session?.user?.id) return { items: [], hasMore: false };

  const rows = await fetchActivityRowsUncached(
    session.user.id,
    sport,
    monthKey,
    offset,
    PAGE_SIZE + 1,
  );

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { items, hasMore };
}
