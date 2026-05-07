import { db } from "@/lib/db";
import { activityPhotos } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";

/**
 * Fetches photo counts for the given activity ids in a single grouped query.
 * Returns a Map keyed by activity id; activities with zero photos are absent.
 */
export async function getPhotoCountsByActivity(
  ids: readonly string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({
      activityId: activityPhotos.activityId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(activityPhotos)
    .where(inArray(activityPhotos.activityId, ids as string[]))
    .groupBy(activityPhotos.activityId);
  return new Map(rows.map((r) => [r.activityId, r.count]));
}
