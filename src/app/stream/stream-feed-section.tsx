import { db } from "@/lib/db";
import {
  activities,
  activityBoosts,
  activityPhotos,
  users,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { EditorialFeed } from "../activities/editorial/editorial-feed";
import { spaceMono } from "../components/bento/bento-fonts";
import type { ActivityFeedItem } from "../activities/actions";

const DAYS_BACK = 14;

interface Props {
  userId: string;
}

export async function StreamFeedSection({ userId }: Props) {
  const meRow = await db
    .select({
      id: users.id,
      partnerId: users.partnerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const me = meRow[0];
  const partnerId = me?.partnerId ?? null;
  const userIds = partnerId ? [userId, partnerId] : [userId];

  const since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);

  const [partnerRow, rawRows, boostRows] = await Promise.all([
    partnerId
      ? db
          .select({
            id: users.id,
            name: users.name,
            image: users.image,
          })
          .from(users)
          .where(eq(users.id, partnerId))
          .limit(1)
      : Promise.resolve(
          [] as { id: string; name: string | null; image: string | null }[],
        ),
    db
      .select({
        id: activities.id,
        userId: activities.userId,
        name: activities.name,
        type: activities.type,
        startTime: activities.startTime,
        distance: activities.distance,
        duration: activities.duration,
        movingTime: activities.movingTime,
        avgHeartRate: activities.avgHeartRate,
        ascent: activities.ascent,
        // Compact preview polyline only — saves ~10 MB per page render
        // vs full routeData track. Same approach as activities/list.
        routeData: activities.routeGeometry,
        photoCount: sql<number>`COALESCE((SELECT COUNT(*)::int FROM ${activityPhotos} WHERE ${activityPhotos.activityId} = ${activities.id}), 0)`,
      })
      .from(activities)
      .where(
        and(
          inArray(activities.userId, userIds),
          gte(activities.startTime, since),
        ),
      )
      .orderBy(desc(activities.startTime)),
    db
      .select({
        activityId: activityBoosts.activityId,
        boosterId: users.id,
        boosterName: users.name,
        boosterImage: users.image,
      })
      .from(activityBoosts)
      .innerJoin(users, eq(activityBoosts.userId, users.id))
      .innerJoin(activities, eq(activityBoosts.activityId, activities.id))
      .where(
        and(
          inArray(activities.userId, userIds),
          gte(activities.startTime, since),
        ),
      ),
  ]);

  const partner = partnerRow[0] ?? null;

  const ownerById = new Map<
    string,
    { id: string; name: string; image: string | null }
  >();
  if (partner) {
    ownerById.set(partner.id, {
      id: partner.id,
      name: partner.name ?? "Partner",
      image: partner.image,
    });
  }

  const boostsByActivity = new Map<
    string,
    { id: string; name: string; image: string | null }[]
  >();
  for (const b of boostRows) {
    const list = boostsByActivity.get(b.activityId) ?? [];
    list.push({
      id: b.boosterId,
      name: b.boosterName ?? "User",
      image: b.boosterImage,
    });
    boostsByActivity.set(b.activityId, list);
  }

  const items: ActivityFeedItem[] = rawRows.map((r) => {
    const owner = r.userId === userId ? undefined : ownerById.get(r.userId);
    const boosters = boostsByActivity.get(r.id) ?? [];
    const boostedByMe = boosters.some((b) => b.id === userId);
    const canBoost = r.userId !== userId;
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      startTime: r.startTime,
      distance: r.distance,
      duration: r.duration,
      movingTime: r.movingTime,
      avgHeartRate: r.avgHeartRate,
      ascent: r.ascent,
      routeData: r.routeData,
      photoCount: r.photoCount ?? 0,
      owner,
      boost: { canBoost, boostedByMe, boosters },
    };
  });

  return (
    <>
      {!partner && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 mb-3">
          <p
            className={`${spaceMono.className} text-[11px] uppercase tracking-[0.14em] text-[#a3a3a3]`}
          >
            Kein Partner verbunden — du siehst nur deine eigenen Aktivitäten.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-8 text-center">
          <p className={`${spaceMono.className} text-sm text-[#a3a3a3]`}>
            Keine Aktivitäten in den letzten {DAYS_BACK} Tagen.
          </p>
        </div>
      ) : (
        <EditorialFeed initial={items} initialHasMore={false} sport={null} />
      )}
    </>
  );
}
