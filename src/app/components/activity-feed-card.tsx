import Link from "next/link";
import { Clock, Heart, Mountain, Ruler, Image as ImageIcon } from "lucide-react";
import { ActivityLottie } from "./activity-lottie";
import { RouteMapStatic } from "./route-map-static";
import { activityTypeLabel, activityTypeColor } from "@/lib/activity-types";
import {
  formatDurationWords as formatDuration,
  formatDistanceAuto,
} from "@/lib/activity-format";

const formatDistance = (m: number) => formatDistanceAuto(m, 1);

interface ActivityFeedCardProps {
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
}

export function ActivityFeedCard(a: ActivityFeedCardProps) {
  const dateLabel = a.startTime.toLocaleDateString("de-CH", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeLabel = a.startTime.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const activeDuration = a.movingTime ?? a.duration;
  const color = activityTypeColor(a.type);
  const hasRoute = Array.isArray(a.routeData) && (a.routeData as unknown[]).length >= 2;

  return (
    <Link
      href={`/activity/${a.id}`}
      className="group relative block overflow-hidden rounded-lg border border-border bg-background hover:shadow-md hover:border-foreground/20 transition-all"
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-center gap-3 p-3 pl-4">
        <div className="flex-shrink-0">
          <ActivityLottie activityType={a.type} activityName={a.name} size={64} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{
                backgroundColor: `${color}1a`,
                color,
              }}
            >
              {activityTypeLabel(a.type)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {dateLabel} · {timeLabel}
            </span>
          </div>
          <div className="font-bold text-lg tracking-[-0.02em] truncate">
            {a.name}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm tabular-nums">
            {a.distance != null && (
              <Stat icon={<Ruler className="h-3.5 w-3.5" />} value={formatDistance(a.distance)} />
            )}
            {activeDuration != null && activeDuration > 0 && (
              <Stat icon={<Clock className="h-3.5 w-3.5" />} value={formatDuration(activeDuration)} />
            )}
            {a.ascent != null && a.ascent > 0 && (
              <Stat icon={<Mountain className="h-3.5 w-3.5" />} value={`${Math.round(a.ascent)} m`} />
            )}
            {a.avgHeartRate != null && (
              <Stat icon={<Heart className="h-3.5 w-3.5" />} value={`${a.avgHeartRate} bpm`} />
            )}
          </div>
        </div>
        {a.photoCount > 0 && (
          <div className="flex-shrink-0 self-start flex items-center gap-1 px-2 py-1 rounded-sm bg-surface border border-border text-[11px] text-muted-foreground">
            <ImageIcon className="h-3 w-3" />
            {a.photoCount}
          </div>
        )}
      </div>
      {hasRoute && (
        <div className="border-t border-border">
          <RouteMapStatic route={a.routeData} color={color} height={200} />
        </div>
      )}
    </Link>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="text-foreground/60">{icon}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </span>
  );
}
