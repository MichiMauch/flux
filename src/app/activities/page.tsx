import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { Activity } from "lucide-react";
import Link from "next/link";
import { rajdhani, spaceMono } from "../components/bento/bento-fonts";
import { BentoSyncButton } from "../components/bento/home/bento-sync-button";
import { BentoHomeWeekly } from "../components/bento/home/bento-home-weekly";
import { BentoHomeGoals } from "../components/bento/home/bento-home-goals";
import { BentoHomeLevel } from "../components/bento/home/bento-home-level";
import { BentoHomeTrophies } from "../components/bento/home/bento-home-trophies";
import { BentoHomeFeedCard } from "../components/bento/home/bento-home-feed-card";

const NEON = "#FF6A00";
const PAGE_SIZE = 20;

function spanForIndex(i: number, hasRoute: boolean, hasPhotos: boolean): string {
  if (i === 0 && hasRoute && hasPhotos) {
    return "md:col-span-6 md:row-span-2";
  }
  if (hasRoute) return "md:col-span-3";
  return "md:col-span-2";
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ take?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const params = await searchParams;
  const take = Math.max(
    PAGE_SIZE,
    Math.min(500, Number(params.take) || PAGE_SIZE)
  );

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
    .where(and(eq(activities.userId, session.user.id)))
    .orderBy(desc(activities.startTime))
    .limit(take + 1);

  const hasMore = myActivities.length > take;
  const items = hasMore ? myActivities.slice(0, take) : myActivities;

  const nextTakeHref = `/activities?take=${take + PAGE_SIZE}`;

  return (
    <div
      className="dark min-h-screen bg-black text-white relative"
      style={{
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
        backgroundImage:
          "linear-gradient(rgba(255,106,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.035) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-4">
        <div className="flex items-end justify-between border-b border-[#2a2a2a] pb-4">
          <div>
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.3em] text-[#a3a3a3] mb-1`}
            >
              ► FLUX // TERMINAL · {new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
            </div>
            <h1
              className={`${rajdhani.className} font-bold uppercase leading-none tracking-[-0.02em]`}
              style={{
                fontSize: "clamp(48px, 7vw, 96px)",
                color: NEON,
                textShadow: `0 0 18px ${NEON}88, 0 0 40px ${NEON}55, 0 0 80px ${NEON}22`,
              }}
            >
              Aktivitäten
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Dashboard
            </Link>
            <BentoSyncButton />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[260px_1fr_260px] items-start">
          <aside className="md:sticky md:top-4 md:self-start space-y-3">
            <BentoHomeWeekly userId={session.user.id} />
            <BentoHomeGoals userId={session.user.id} />
          </aside>

          <div className="min-w-0">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#a3a3a3]">
                <Activity className="h-12 w-12 mb-4" />
                <p
                  className={`${spaceMono.className} text-lg font-bold uppercase tracking-[0.14em]`}
                >
                  Noch keine Aktivitäten
                </p>
                <p className={`${spaceMono.className} text-sm mt-1`}>
                  Verbinde deinen Polar-Account, um Aktivitäten zu synchronisieren.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
                {items.map((a, i) => {
                  const hasRoute =
                    Array.isArray(a.routeData) &&
                    (a.routeData as unknown[]).length >= 2;
                  const spans = spanForIndex(i, hasRoute, a.photoCount > 0);
                  return (
                    <div key={a.id} className={spans}>
                      <BentoHomeFeedCard {...a} hero={i === 0 && hasRoute && a.photoCount > 0} />
                    </div>
                  );
                })}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Link
                  href={nextTakeHref}
                  className={`${spaceMono.className} inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] border border-[#2a2a2a] text-[#9ca3af] hover:text-white hover:border-[#4a4a4a] transition-colors`}
                  scroll={false}
                >
                  Mehr laden
                </Link>
              </div>
            )}
          </div>

          <aside className="md:sticky md:top-4 md:self-start space-y-3">
            <BentoHomeLevel userId={session.user.id} />
            <BentoHomeTrophies userId={session.user.id} />
          </aside>
        </div>
      </main>
    </div>
  );
}
