import Link from "next/link";
import { Clock, Heart, Mountain, Ruler, Image as ImageIcon } from "lucide-react";
import { activityTypeLabel, activityTypeColor } from "@/lib/activity-types";
import { RouteMapStatic } from "@/app/components/route-map-static";
import { rajdhani, spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

interface Props {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
  duration: number | null;
  movingTime: number | null;
  avgHeartRate: number | null;
  ascent: number | null;
  routeData?: unknown;
  photoCount: number;
  hero?: boolean;
}

function formatDurationShort(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}`;
  return `${m}`;
}

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

export function BentoHomeFeedCard(a: Props) {
  const color = activityTypeColor(a.type);
  const hasRoute = Array.isArray(a.routeData) && (a.routeData as unknown[]).length >= 2;
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
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] transition-all hover:border-[#2a2a2a]"
      style={{ boxShadow: `inset 0 0 0 1px transparent` }}
    >
      {hasRoute && (
        <div className="border-b border-[#1f1f1f]">
          <RouteMapStatic route={a.routeData} color={color} height={a.hero ? 240 : 140} />
        </div>
      )}
      <div className="flex-1 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`${spaceMono.className} inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.12em]`}
            style={{ backgroundColor: `${color}1a`, color }}
          >
            {activityTypeLabel(a.type)}
          </span>
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b6b6b]`}
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
            fontSize: a.hero ? "clamp(24px, 2.5vw, 34px)" : "clamp(16px, 1.6vw, 22px)",
            color,
            textShadow: `0 0 10px ${color}55, 0 0 20px ${color}33`,
          }}
          title={a.name}
        >
          {a.name}
        </div>
        <div
          className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-auto"
          style={{ fontSize: a.hero ? "24px" : "20px" }}
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

function Metric({
  icon,
  value,
  unit,
}: {
  icon: React.ReactNode;
  value: string;
  unit: string;
}) {
  const NEON = "#FF6A00";
  return (
    <span className="inline-flex items-baseline gap-1 leading-none">
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
