import Link from "next/link";
import { Clock, Heart, Mountain, Ruler, Image as ImageIcon } from "lucide-react";
import { ActivityLottie } from "./activity-lottie";
import { activityTypeLabel } from "@/lib/activity-types";

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
  photoCount: number;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
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

  return (
    <Link
      href={`/activity/${a.id}`}
      className="block rounded-lg border border-border bg-background hover:bg-surface/50 transition-colors"
    >
      <div className="flex items-center gap-3 p-3">
        <div className="flex-shrink-0">
          <ActivityLottie activityType={a.type} size={64} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-0.5">
            {activityTypeLabel(a.type)} · {dateLabel} · {timeLabel}
          </div>
          <div className="font-bold text-base tracking-[-0.02em] truncate">
            {a.name}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs tabular-nums">
            {a.distance != null && (
              <Stat icon={<Ruler className="h-3 w-3" />} value={formatDistance(a.distance)} />
            )}
            {activeDuration != null && activeDuration > 0 && (
              <Stat icon={<Clock className="h-3 w-3" />} value={formatDuration(activeDuration)} />
            )}
            {a.ascent != null && a.ascent > 0 && (
              <Stat icon={<Mountain className="h-3 w-3" />} value={`${Math.round(a.ascent)} m`} />
            )}
            {a.avgHeartRate != null && (
              <Stat icon={<Heart className="h-3 w-3" />} value={`${a.avgHeartRate} bpm`} />
            )}
          </div>
        </div>
        {a.photoCount > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-sm bg-surface border border-border text-[11px] text-muted-foreground">
            <ImageIcon className="h-3 w-3" />
            {a.photoCount}
          </div>
        )}
      </div>
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
