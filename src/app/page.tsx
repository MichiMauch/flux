import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Navbar } from "./components/navbar";
import { SyncButton } from "./components/sync-button";
import { WeeklySummary } from "./components/weekly-summary";
import { GoalsSummary } from "./components/goals-summary";
import { LevelWidget } from "./components/level-widget";
import { EarnedTrophies } from "./components/earned-trophies";
import { ActivityFeedCard } from "./components/activity-feed-card";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { Activity } from "lucide-react";
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
  const take = Math.max(
    PAGE_SIZE,
    Math.min(500, Number(params.take) || PAGE_SIZE)
  );

  const conditions = [eq(activities.userId, session.user.id)];

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
      routeData: activities.routeData,
      photoCount: photoCountSql,
    })
    .from(activities)
    .where(and(...conditions))
    .orderBy(desc(activities.startTime))
    .limit(take + 1);

  const hasMore = myActivities.length > take;
  const items = hasMore ? myActivities.slice(0, take) : myActivities;

  const nextTakeHref = `/?take=${take + PAGE_SIZE}`;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-[-0.025em]">Aktivitäten</h1>
          <SyncButton />
        </div>

        <div className="grid gap-4 md:grid-cols-[260px_1fr_260px] items-start">
          <aside className="md:sticky md:top-4 md:self-start space-y-3">
            <WeeklySummary userId={session.user.id} />
            <GoalsSummary userId={session.user.id} />
          </aside>
          <div className="space-y-4 min-w-0">
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
          </div>
          <aside className="md:sticky md:top-4 md:self-start space-y-3">
            <LevelWidget userId={session.user.id} />
            <EarnedTrophies userId={session.user.id} />
          </aside>
        </div>
      </main>
    </>
  );
}
