import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities, activityBoosts, users } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getPhotoCountsByActivity } from "@/lib/activities/photo-counts";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoSyncButton } from "../components/bento/home/bento-sync-button";
import { EditorialFeed } from "../activities/editorial/editorial-feed";
import { spaceMono } from "../components/bento/bento-fonts";
import type { ActivityFeedItem } from "../activities/actions";

const DAYS_BACK = 14;

export default async function StreamPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const [me] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      partnerId: users.partnerId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const partnerRow = me?.partnerId
    ? await db
        .select({
          id: users.id,
          name: users.name,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, me.partnerId))
        .limit(1)
    : [];
  const partner = partnerRow[0] ?? null;

  const userIds = [userId, ...(partner ? [partner.id] : [])];

  const since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);

  const rawRows = await db
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
      routeData: sql<unknown>`COALESCE(${activities.routeGeometry}, ${activities.routeData})`,
    })
    .from(activities)
    .where(
      and(
        inArray(activities.userId, userIds),
        gte(activities.startTime, since),
      ),
    )
    .orderBy(desc(activities.startTime));

  const photoCounts = await getPhotoCountsByActivity(rawRows.map((r) => r.id));
  const rows = rawRows.map((r) => ({
    ...r,
    photoCount: photoCounts.get(r.id) ?? 0,
  }));

  const ownerById = new Map<string, { id: string; name: string; image: string | null }>();
  if (partner) {
    ownerById.set(partner.id, {
      id: partner.id,
      name: partner.name ?? "Partner",
      image: partner.image,
    });
  }

  const activityIds = rows.map((r) => r.id);
  const boostRows =
    activityIds.length === 0
      ? []
      : await db
          .select({
            activityId: activityBoosts.activityId,
            userId: users.id,
            userName: users.name,
            userImage: users.image,
          })
          .from(activityBoosts)
          .innerJoin(users, eq(activityBoosts.userId, users.id))
          .where(inArray(activityBoosts.activityId, activityIds));

  const boostsByActivity = new Map<
    string,
    { id: string; name: string; image: string | null }[]
  >();
  for (const b of boostRows) {
    const list = boostsByActivity.get(b.activityId) ?? [];
    list.push({
      id: b.userId,
      name: b.userName ?? "User",
      image: b.userImage,
    });
    boostsByActivity.set(b.activityId, list);
  }

  const items: ActivityFeedItem[] = rows.map((r) => {
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
    <BentoPageShell>
      <BentoPageHeader
        section="Aktivitäten"
        title="Stream"
        right={<BentoSyncButton />}
      />

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
    </BentoPageShell>
  );
}
