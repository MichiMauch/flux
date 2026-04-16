import { Activity, Ruler, Clock, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function monthRange(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(0);
}
function formatDurationH(sec: number): string {
  const h = Math.floor(sec / 3600);
  return String(h);
}

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

export async function BentoDashboardMonthly({ userId }: { userId: string }) {
  const { from, to } = monthRange();
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
  const monthLabel = MONTHS[from.getMonth()];

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-3 h-full">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]`}
        >
          Dieser Monat
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
          style={{ color: NEON }}
        >
          {monthLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<Activity className="h-3 w-3" />} label="Aktiv." value={String(count)} />
        <Stat
          icon={<Ruler className="h-3 w-3" />}
          label="Distanz"
          value={distance > 0 ? formatDistanceKm(distance) : "–"}
          unit="km"
        />
        <Stat
          icon={<Clock className="h-3 w-3" />}
          label="Zeit"
          value={duration > 0 ? formatDurationH(duration) : "–"}
          unit="h"
        />
        <Stat
          icon={<Zap className="h-3 w-3" />}
          label="TRIMP"
          value={trimp > 0 ? String(Math.round(trimp)) : "–"}
        />
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
        style={{ fontSize: "18px" }}
      >
        <SevenSegDisplay value={value} />
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
