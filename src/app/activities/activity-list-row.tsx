import Link from "next/link";
import {
  Activity as ActivityIcon,
  Bike,
  Clock,
  Dumbbell,
  Footprints,
  Heart,
  Image as ImageIcon,
  Moon,
  Mountain,
  MountainSnow,
  Ruler,
  Snowflake,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { activityTypeColor, activityTypeLabel } from "@/lib/activity-types";
import { RouteMapStatic } from "@/app/components/route-map-static";
import { rajdhani, spaceMono } from "@/app/components/bento/bento-fonts";
import { SevenSegDisplay } from "@/app/components/bento/seven-seg";
import type { ActivityFeedItem } from "./actions";

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

function sportIcon(type: string): LucideIcon {
  const t = type.toUpperCase();
  if (t.includes("RUN") || t.includes("JOG")) return Footprints;
  if (t.includes("WALK")) return Footprints;
  if (t.includes("HIK") || t.includes("TREK")) return MountainSnow;
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return Bike;
  if (t.includes("STRENGTH") || t.includes("CORE")) return Dumbbell;
  if (t.includes("SWIM")) return Waves;
  if (t.includes("SKI") || t.includes("SNOW")) return Snowflake;
  if (t.includes("SLEEP")) return Moon;
  return ActivityIcon;
}

export function ActivityListRow(a: ActivityFeedItem) {
  const color = activityTypeColor(a.type);
  const hasRoute =
    Array.isArray(a.routeData) && (a.routeData as unknown[]).length >= 2;
  const activeDuration = a.movingTime ?? a.duration;
  const dateLabel = a.startTime.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  const timeLabel = a.startTime.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/activity/${a.id}`}
      className="activity-list-row group grid grid-cols-[140px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-2 transition-all"
      style={{ ["--sport-color" as string]: color } as React.CSSProperties}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-[#1f1f1f] bg-[#050505]">
        {hasRoute ? (
          <RouteMapStatic
            route={a.routeData}
            color={color}
            width={440}
            height={275}
          />
        ) : (
          <SportIconPlaceholder type={a.type} color={color} />
        )}
      </div>
      <div className="min-w-0 flex flex-col justify-center gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`${spaceMono.className} inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]`}
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {activityTypeLabel(a.type)}
          </span>
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3]`}
          >
            {dateLabel} · {timeLabel}
          </span>
          {a.photoCount > 0 && (
            <span
              className={`${spaceMono.className} inline-flex items-center gap-1 text-[10px] text-[#9ca3af]`}
            >
              <ImageIcon className="h-3 w-3" />
              {a.photoCount}
            </span>
          )}
        </div>
        <div
          className={`${rajdhani.className} font-bold uppercase leading-tight tracking-[-0.01em] truncate`}
          style={{
            fontSize: "clamp(18px, 1.9vw, 26px)",
            color,
            textShadow: `0 0 10px ${color}55, 0 0 20px ${color}33`,
          }}
          title={a.name}
        >
          {a.name}
        </div>
        <div
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
          style={{ fontSize: "18px" }}
        >
          {a.distance != null && (
            <Metric
              icon={<Ruler className="h-3 w-3" />}
              value={formatDistanceKm(a.distance)}
              unit="km"
            />
          )}
          {activeDuration != null && activeDuration > 0 && (
            <Metric
              icon={<Clock className="h-3 w-3" />}
              value={formatDurationShort(activeDuration)}
              unit={activeDuration >= 3600 ? "h" : "min"}
            />
          )}
          {a.ascent != null && a.ascent > 0 && (
            <Metric
              icon={<Mountain className="h-3 w-3" />}
              value={String(Math.round(a.ascent))}
              unit="m"
            />
          )}
          {a.avgHeartRate != null && (
            <Metric
              icon={<Heart className="h-3 w-3" />}
              value={String(a.avgHeartRate)}
              unit="bpm"
            />
          )}
        </div>
      </div>
    </Link>
  );
}

function SportIconPlaceholder({
  type,
  color,
}: {
  type: string;
  color: string;
}) {
  const Icon = sportIcon(type);
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5"
      style={{
        background: `radial-gradient(circle at 50% 45%, ${color}22, transparent 70%), #0a0a0a`,
      }}
    >
      <Icon
        className="h-8 w-8 md:h-10 md:w-10"
        style={{
          color,
          filter: `drop-shadow(0 0 8px ${color}aa) drop-shadow(0 0 16px ${color}66)`,
        }}
        strokeWidth={1.5}
      />
      <span
        className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em]`}
        style={{ color: `${color}cc` }}
      >
        {activityTypeLabel(type)}
      </span>
    </div>
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
    <span className="inline-flex items-baseline gap-1 leading-none">
      <span
        className={`${spaceMono.className} text-[0.5em]`}
        style={{ color: "#a3a3a3" }}
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
