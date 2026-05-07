import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getPhotoCountsByActivity } from "@/lib/activities/photo-counts";
import { BentoPageShell } from "../../components/bento/bento-page-shell";
import { BentoPageHeader } from "../../components/bento/bento-page-header";
import { BentoSyncButton } from "../../components/bento/home/bento-sync-button";
import { spaceMono } from "../../components/bento/bento-fonts";
import { ActivitiesSportFilter } from "../activities-sport-filter";
import { ActivitiesTimelineRibbon } from "../activities-timeline-ribbon";
import { ActivitiesFeed } from "../activities-feed";
import { parseSport } from "../filters";

const INITIAL_PAGE_SIZE = 20;

export default async function ActivitiesListPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const sport = parseSport(params.sport);

  const whereUserAndSport = sport
    ? and(eq(activities.userId, userId), eq(activities.type, sport))
    : eq(activities.userId, userId);

  const [rawRows, availableSports, monthRows] = await Promise.all([
    db
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
      })
      .from(activities)
      .where(whereUserAndSport)
      .orderBy(desc(activities.startTime))
      .limit(INITIAL_PAGE_SIZE + 1),
    db
      .selectDistinct({ type: activities.type })
      .from(activities)
      .where(eq(activities.userId, userId))
      .then((rs) => rs.map((r) => r.type).sort()),
    db
      .selectDistinct({
        key: sql<string>`to_char(${activities.startTime}, 'YYYY-MM')`,
      })
      .from(activities)
      .where(whereUserAndSport)
      .orderBy(desc(sql`to_char(${activities.startTime}, 'YYYY-MM')`))
      .then((rs) => rs.map((r) => r.key)),
  ]);

  const photoCounts = await getPhotoCountsByActivity(rawRows.map((r) => r.id));
  const initialRows = rawRows.map((r) => ({
    ...r,
    photoCount: photoCounts.get(r.id) ?? 0,
  }));

  const hasMore = initialRows.length > INITIAL_PAGE_SIZE;
  const initial = hasMore ? initialRows.slice(0, INITIAL_PAGE_SIZE) : initialRows;

  return (
    <BentoPageShell>
      <BentoPageHeader
        section="Aktivitäten"
        title="Aktivitäten"
        right={
          <div className="flex items-center gap-3">
            <Link
              href="/activities"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ❏ Editorial
            </Link>
            <Link
              href="/"
              className={`${spaceMono.className} inline-flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a3a3a3] hover:text-white hover:border-[#4a4a4a]`}
            >
              ← Dashboard
            </Link>
            <BentoSyncButton />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="min-w-0 md:max-w-[55%]">
          <ActivitiesSportFilter
            sport={sport}
            availableSports={availableSports}
            basePath="/activities/list"
          />
        </div>
        <div className="min-w-0 flex-1">
          <ActivitiesTimelineRibbon months={monthRows} />
        </div>
      </div>

      <ActivitiesFeed
        initial={initial}
        initialHasMore={hasMore}
        sport={sport}
      />
    </BentoPageShell>
  );
}
