import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities, activityPhotos, users } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoSyncButton } from "../components/bento/home/bento-sync-button";
import { BentoHomeFeedCard } from "../components/bento/home/bento-home-feed-card";
import { spaceMono } from "../components/bento/bento-fonts";

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

  const photoCountSql = sql<number>`(
    SELECT COUNT(*)::int
    FROM ${activityPhotos}
    WHERE ${activityPhotos.activityId} = ${activities.id}
  )`;

  const rows = await db
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
      routeData: activities.routeData,
      photoCount: photoCountSql,
    })
    .from(activities)
    .where(
      and(
        inArray(activities.userId, userIds),
        gte(activities.startTime, since),
      ),
    )
    .orderBy(desc(activities.startTime));

  const ownerById = new Map<string, { name: string; image: string | null }>();
  if (me) {
    ownerById.set(me.id, { name: me.name ?? "Du", image: me.image });
  }
  if (partner) {
    ownerById.set(partner.id, {
      name: partner.name ?? "Partner",
      image: partner.image,
    });
  }

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
            Im Profil kannst du eine Partner-Verknüpfung einrichten.
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-8 text-center">
          <p
            className={`${spaceMono.className} text-sm text-[#a3a3a3]`}
          >
            Keine Aktivitäten in den letzten {DAYS_BACK} Tagen.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => {
            const owner = ownerById.get(r.userId);
            return (
              <BentoHomeFeedCard
                key={r.id}
                id={r.id}
                name={r.name}
                type={r.type}
                startTime={r.startTime}
                distance={r.distance}
                duration={r.duration}
                movingTime={r.movingTime}
                avgHeartRate={r.avgHeartRate}
                ascent={r.ascent}
                routeData={r.routeData}
                photoCount={r.photoCount ?? 0}
                owner={owner}
              />
            );
          })}
        </div>
      )}
    </BentoPageShell>
  );
}
