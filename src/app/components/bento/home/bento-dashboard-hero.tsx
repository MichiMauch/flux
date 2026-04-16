import Link from "next/link";
import { Activity, Clock, Heart, Mountain, Ruler } from "lucide-react";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { activityTypeLabel, activityTypeColor } from "@/lib/activity-types";
import { RouteMapStatic } from "@/app/components/route-map-static";
import { rajdhani, spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}`;
  return `${m}`;
}

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

export async function BentoDashboardHero({ userId }: { userId: string }) {
  const photoCountSql = sql<number>`(
    SELECT COUNT(*)::int
    FROM ${activityPhotos}
    WHERE ${activityPhotos.activityId} = ${activities.id}
  )`;

  const [latest] = await db
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
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.startTime))
    .limit(1);

  if (!latest) {
    return (
      <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-6 h-full flex flex-col items-center justify-center text-center gap-3">
        <Activity className="h-10 w-10 text-[#6b6b6b]" />
        <div
          className={`${spaceMono.className} text-sm font-bold uppercase tracking-[0.14em] text-[#9ca3af]`}
        >
          Noch keine Aktivität
        </div>
        <div
          className={`${spaceMono.className} text-xs text-[#6b6b6b] max-w-[280px]`}
        >
          Verbinde deinen Polar-Account und klicke oben auf „Sync", um die erste Aktivität zu laden.
        </div>
      </div>
    );
  }

  const color = activityTypeColor(latest.type);
  const TITLE = "#F5FF3C";
  const hasRoute =
    Array.isArray(latest.routeData) && (latest.routeData as unknown[]).length >= 2;
  const activeDuration = latest.movingTime ?? latest.duration;
  const dateLabel = latest.startTime.toLocaleDateString("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = latest.startTime.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/activity/${latest.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] transition-all hover:border-[#2a2a2a]"
    >
      {hasRoute && (
        <div className="border-b border-[#1f1f1f]">
          <RouteMapStatic route={latest.routeData} color={color} height={260} />
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b6b6b]`}
            >
              ► Letzte Aktivität
            </span>
            <span
              className={`${spaceMono.className} inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]`}
              style={{ backgroundColor: `${color}1a`, color }}
            >
              {activityTypeLabel(latest.type)}
            </span>
          </div>
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b6b6b]`}
          >
            {dateLabel} · {timeLabel}
          </span>
        </div>
        <div
          className={`${rajdhani.className} font-bold uppercase leading-tight tracking-[-0.01em]`}
          style={{
            fontSize: "clamp(22px, 2.4vw, 36px)",
            color: TITLE,
            textShadow: `0 0 14px ${TITLE}88, 0 0 28px ${TITLE}55`,
          }}
          title={latest.name}
        >
          {latest.name}
        </div>
        <div
          className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mt-auto"
          style={{ fontSize: "28px" }}
        >
          {latest.distance != null && (
            <Metric
              icon={<Ruler className="h-3.5 w-3.5" />}
              value={formatDistanceKm(latest.distance)}
              unit="km"
            />
          )}
          {activeDuration != null && activeDuration > 0 && (
            <Metric
              icon={<Clock className="h-3.5 w-3.5" />}
              value={formatDurationShort(activeDuration)}
              unit={activeDuration >= 3600 ? "h" : "min"}
            />
          )}
          {latest.ascent != null && latest.ascent > 0 && (
            <Metric
              icon={<Mountain className="h-3.5 w-3.5" />}
              value={String(Math.round(latest.ascent))}
              unit="m"
            />
          )}
          {latest.avgHeartRate != null && (
            <Metric
              icon={<Heart className="h-3.5 w-3.5" />}
              value={String(latest.avgHeartRate)}
              unit="bpm"
            />
          )}
        </div>
      </div>
    </Link>
  );
}

function Metric({
  icon,
  value,
  unit,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 leading-none">
      <span
        className={`${spaceMono.className} text-[0.5em]`}
        style={{ color: "#6b6b6b" }}
      >
        {icon}
      </span>
      <SevenSegDisplay value={value} />
      <span
        className={`${spaceMono.className} text-[0.4em] font-bold lowercase`}
        style={{ color: NEON }}
      >
        {unit}
      </span>
    </span>
  );
}
