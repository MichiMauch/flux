import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { currentWeekRange, isoWeek } from "@/lib/activity-week";
import { Activity, Ruler, Zap } from "lucide-react";

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export async function WeeklySummary({ userId }: { userId: string }) {
  const { from, to } = currentWeekRange();
  const rows = await db
    .select({
      distance: activities.distance,
      duration: activities.duration,
      trimp: activities.trimp,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  const count = rows.length;
  const distance = rows.reduce((s, r) => s + (r.distance ?? 0), 0);
  const duration = rows.reduce((s, r) => s + (r.duration ?? 0), 0);
  const trimp = rows.reduce((s, r) => s + (r.trimp ?? 0), 0);

  const weekNo = isoWeek(from);

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Diese Woche
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          KW {weekNo}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SummaryStat icon={<Activity className="h-3.5 w-3.5" />} label="Aktivitäten" value={count.toString()} />
        <SummaryStat icon={<Ruler className="h-3.5 w-3.5" />} label="Distanz" value={distance > 0 ? formatDistance(distance) : "–"} />
        <SummaryStat icon={<Activity className="h-3.5 w-3.5" />} label="Zeit" value={duration > 0 ? formatDuration(duration) : "–"} />
        <SummaryStat icon={<Zap className="h-3.5 w-3.5" />} label="TRIMP" value={trimp > 0 ? Math.round(trimp).toString() : "–"} accent />
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={accent ? "text-brand" : "text-muted-foreground"}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
        <div className={`text-base font-bold tabular-nums tracking-[-0.02em] ${accent ? "text-brand" : ""}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
