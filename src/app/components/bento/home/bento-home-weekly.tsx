import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { currentWeekRange, isoWeek } from "@/lib/activity-week";
import { Activity, Ruler, Clock } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

function formatDurationHm(sec: number): { value: string; unit: string } {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return { value: `${h}:${String(m).padStart(2, "0")}`, unit: "h" };
  return { value: String(m), unit: "m" };
}

export async function BentoHomeWeekly({ userId }: { userId: string }) {
  const { from, to } = currentWeekRange();
  const rows = await db
    .select({
      distance: activities.distance,
      duration: activities.duration,
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
  const weekNo = isoWeek(from);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-3">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]`}
        >
          Diese Woche
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
          style={{ color: NEON }}
        >
          KW {weekNo}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 flex-1 content-center">
        <Stat icon={<Activity className="h-3 w-3" />} label="Aktiv." value={String(count)} />
        <Stat
          icon={<Ruler className="h-3 w-3" />}
          label="Distanz"
          value={distance > 0 ? formatDistanceKm(distance) : "–"}
          unit="km"
        />
        {(() => {
          const d = duration > 0 ? formatDurationHm(duration) : { value: "–", unit: "" };
          return (
            <Stat
              icon={<Clock className="h-3 w-3" />}
              label="Zeit"
              value={d.value}
              unit={d.unit || undefined}
            />
          );
        })()}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
}) {
  const isNumeric = /^[0-9'.:-]+$/.test(value);
  return (
    <div>
      <div
        className={`flex items-center gap-1 ${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#6b6b6b] mb-1`}
      >
        <span style={{ color: NEON }}>{icon}</span>
        {label}
      </div>
      <div
        className="flex items-baseline gap-1 leading-none"
        style={{ fontSize: "32px" }}
      >
        {isNumeric ? (
          <SevenSegDisplay value={value} />
        ) : (
          <span
            className={`${spaceMono.className} text-sm font-bold text-white`}
          >
            {value}
          </span>
        )}
        {unit && (
          <span
            className={`${spaceMono.className} text-[0.45em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
