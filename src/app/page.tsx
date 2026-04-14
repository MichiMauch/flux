import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "./components/navbar";
import { SyncButton } from "./components/sync-button";
import { WeeklySummary } from "./components/weekly-summary";
import { ActivityFeedCard } from "./components/activity-feed-card";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { Activity } from "lucide-react";
import { activityTypeLabel } from "@/lib/activity-types";
import Link from "next/link";

const PAGE_SIZE = 20;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; take?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const typeFilter = params.type;
  const take = Math.max(
    PAGE_SIZE,
    Math.min(500, Number(params.take) || PAGE_SIZE)
  );

  const conditions = [eq(activities.userId, session.user.id)];
  if (typeFilter) conditions.push(eq(activities.type, typeFilter));

  // Photo count subquery
  const photoCountSql = sql<number>`(
    SELECT COUNT(*)::int
    FROM ${activityPhotos}
    WHERE ${activityPhotos.activityId} = ${activities.id}
  )`;

  const myActivities = await db
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
      photoCount: photoCountSql,
    })
    .from(activities)
    .where(and(...conditions))
    .orderBy(desc(activities.startTime))
    .limit(take + 1);

  const hasMore = myActivities.length > take;
  const items = hasMore ? myActivities.slice(0, take) : myActivities;

  const allTypes = await db
    .selectDistinct({ type: activities.type })
    .from(activities)
    .where(eq(activities.userId, session.user.id));
  const types = allTypes.map((t) => t.type);

  const nextTakeHref = (() => {
    const qp = new URLSearchParams();
    if (typeFilter) qp.set("type", typeFilter);
    qp.set("take", String(take + PAGE_SIZE));
    return `/?${qp.toString()}`;
  })();

  const filterHref = (t: string | null) => {
    const qp = new URLSearchParams();
    if (t) qp.set("type", t);
    const q = qp.toString();
    return q ? `/?${q}` : "/";
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Aktivitäten</h1>
          <SyncButton />
        </div>

        <WeeklySummary userId={session.user.id} />

        {/* Type Filter */}
        {types.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href={filterHref(null)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                !typeFilter
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
              }`}
            >
              Alle
            </Link>
            {types.map((t) => (
              <Link
                key={t}
                href={filterHref(t)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                  typeFilter === t
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground"
                }`}
              >
                {activityTypeLabel(t)}
              </Link>
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Activity className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Noch keine Aktivitäten</p>
            <p className="text-sm mt-1">
              Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((a) => (
                <ActivityFeedCard key={a.id} {...a} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Link
                  href={nextTakeHref}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold border border-border hover:bg-surface transition-colors"
                  scroll={false}
                >
                  Mehr laden
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
