import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { currentWeekRange, isoWeek } from "@/lib/activity-week";
import { Activity, Ruler, Zap } from "lucide-react";
import {
  formatDurationWords as formatDuration,
  formatDistanceAuto,
} from "@/lib/activity-format";

const formatDistance = (m: number) => formatDistanceAuto(m, 1);

export async function WeeklySummary({ userId }: { userId: string }) {
  const { from, to } = currentWeekRange();
  const rows = await db
    .select({
      distance: activities.distance,
      duration: activities.duration,
      movingTime: activities.movingTime,
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
  const duration = rows.reduce(
    (s, r) => s + (r.movingTime ?? r.duration ?? 0),
    0,
  );
  const trimp = rows.reduce((s, r) => s + (r.trimp ?? 0), 0);

  const weekNo = isoWeek(from);

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-black/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d0c5ba]">
          Diese Woche
        </span>
        <span className="text-[11px] font-bold tabular-nums text-[#d0c5ba]">
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
      <span className={accent ? "text-[#FF6A00]" : "text-[#9ca3af]"}>{icon}</span>
      <div className="leading-tight">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]">
          {label}
        </div>
        <div className={`text-base font-bold tabular-nums tracking-[-0.02em] ${accent ? "text-[#FF6A00]" : "text-white"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
