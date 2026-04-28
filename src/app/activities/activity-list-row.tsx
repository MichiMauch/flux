import Link from "next/link";
import {
  Clock,
  Heart,
  Image as ImageIcon,
  Mountain,
  Ruler,
} from "lucide-react";
import { activityTypeColor } from "@/lib/activity-types";
import { SportChip } from "@/app/components/sport-chip";
import {
  formatDateLabel,
  formatDistanceKm,
  formatDurationShort,
  formatTimeLabel,
} from "@/lib/activity-format";
import { RouteMapStatic } from "@/app/components/route-map-static";
import { ActivityMetric } from "@/app/components/activity-metric";
import { rajdhani, spaceMono } from "@/app/components/bento/bento-fonts";
import type { ActivityFeedItem } from "./actions";
import { SportIconPlaceholder } from "./sport-icon-placeholder";

export function ActivityListRow(
  a: ActivityFeedItem & { asStatic?: boolean }
) {
  const color = activityTypeColor(a.type);
  const hasRoute =
    Array.isArray(a.routeData) && (a.routeData as unknown[]).length >= 2;
  const activeDuration = a.movingTime ?? a.duration;
  const className =
    "activity-list-row group grid grid-cols-[140px_1fr] md:grid-cols-[220px_1fr] gap-3 md:gap-4 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-2 transition-all";
  const style = { ["--sport-color" as string]: color } as React.CSSProperties;

  const inner = (
    <>
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
          <SportChip type={a.type} variant="mono" />
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3]`}
          >
            {formatDateLabel(a.startTime)} · {formatTimeLabel(a.startTime)}
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
            <ActivityMetric
              icon={<Ruler className="h-3 w-3" />}
              value={formatDistanceKm(a.distance)}
              unit="km"
            />
          )}
          {activeDuration != null && activeDuration > 0 && (
            <ActivityMetric
              icon={<Clock className="h-3 w-3" />}
              value={formatDurationShort(activeDuration)}
              unit={activeDuration >= 3600 ? "h" : "min"}
            />
          )}
          {a.ascent != null && a.ascent > 0 && (
            <ActivityMetric
              icon={<Mountain className="h-3 w-3" />}
              value={String(Math.round(a.ascent))}
              unit="m"
            />
          )}
          {a.avgHeartRate != null && (
            <ActivityMetric
              icon={<Heart className="h-3 w-3" />}
              value={String(a.avgHeartRate)}
              unit="bpm"
            />
          )}
        </div>
      </div>
    </>
  );

  if (a.asStatic) {
    return (
      <div className={className} style={style}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/activity/${a.id}`} className={className} style={style}>
      {inner}
    </Link>
  );
}
