import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";

/**
 * Sum TRIMP per local calendar day for a user between [from, to] inclusive.
 * Returns a Map<YYYY-MM-DD, number>. Days with no activity are simply absent.
 */
export async function getDailyTrimp(
  userId: string,
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const day = sql<string>`to_char(${activities.startTime}, 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      day,
      total: sql<number>`coalesce(sum(${activities.trimp}), 0)`,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        isNotNull(activities.trimp),
        gte(activities.startTime, from),
        lte(activities.startTime, to)
      )
    )
    .groupBy(day);

  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.total != null) map.set(r.day, Number(r.total));
  }
  return map;
}
