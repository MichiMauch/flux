import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { rajdhani, spaceMono } from "../../components/bento/bento-fonts";
import { BentoSyncButton } from "../../components/bento/home/bento-sync-button";
import { ActivitiesSportFilter } from "../activities-sport-filter";
import { ActivitiesTimelineRibbon } from "../activities-timeline-ribbon";
import { parseSport } from "../filters";
import { EditorialFeed } from "./editorial-feed";

const INITIAL_PAGE_SIZE = 20;

export default async function EditorialActivitiesPage({
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

  const photoCountSql = sql<number>`(
    SELECT COUNT(*)::int
    FROM ${activityPhotos}
    WHERE ${activityPhotos.activityId} = ${activities.id}
  )`;

  const [initialRows, availableSports, monthRows] = await Promise.all([
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
        photoCount: photoCountSql,
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

  const hasMore = initialRows.length > INITIAL_PAGE_SIZE;
  const initial = hasMore
    ? initialRows.slice(0, INITIAL_PAGE_SIZE)
    : initialRows;

  const dateLabel = new Date()
    .toLocaleDateString("de-CH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

  return (
    <div
      className="dark min-h-screen text-white relative"
      style={{
        backgroundColor: "#121212",
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 220 220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "220px 220px",
        }}
      />
      <main className="relative mx-auto w-full max-w-[1440px] px-6 py-10 md:px-10 md:py-14 space-y-10">
        <header className="flex flex-col gap-6 border-b border-[#242424] pb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div
              className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.36em] text-[#808080] mb-3`}
            >
              FLUX // EDITORIAL · {dateLabel}
            </div>
            <h1
              className={`${rajdhani.className} font-bold uppercase leading-[0.82] tracking-[-0.04em]`}
              style={{
                fontSize: "clamp(56px, 9vw, 148px)",
                color: "#f4f4f4",
              }}
            >
              Aktivitäten
              <span
                className="ml-4"
                style={{ color: "#FF6A00", textShadow: "0 0 30px #FF6A0066" }}
              >
                .
              </span>
            </h1>
            <p
              className={`${spaceMono.className} mt-3 text-xs tracking-[0.18em] uppercase text-[#9a9a9a] max-w-xl`}
            >
              Distanz, Route und Zeit — als redaktionelle Zeitleiste.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/activities"
              className={`${spaceMono.className} inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3] transition hover:border-[#4a4a4a] hover:text-white`}
            >
              ▦ Bento-Ansicht
            </Link>
            <Link
              href="/"
              className={`${spaceMono.className} inline-flex items-center gap-1.5 rounded-md border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a3a3a3] transition hover:border-[#4a4a4a] hover:text-white`}
            >
              ← Dashboard
            </Link>
            <BentoSyncButton />
          </div>
        </header>

        <div className="space-y-3">
          <ActivitiesSportFilter
            sport={sport}
            availableSports={availableSports}
          />
          <ActivitiesTimelineRibbon months={monthRows} />
        </div>

        <EditorialFeed
          initial={initial}
          initialHasMore={hasMore}
          sport={sport}
        />
      </main>
    </div>
  );
}
