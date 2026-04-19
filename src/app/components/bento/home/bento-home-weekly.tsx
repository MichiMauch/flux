import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { currentWeekRange, isoWeek } from "@/lib/activity-week";
import { Activity, Ruler, Clock } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import {
  formatDistanceKm as sharedFormatDistanceKm,
  formatDurationHmSplit,
} from "@/lib/activity-format";

const NEON = "#FF6A00";
const UP = "#39FF14";
const DOWN = "#FF3B30";

const formatDistanceKm = (m: number) => sharedFormatDistanceKm(m, 1);
const formatDurationHm = formatDurationHmSplit;

function delta(current: number, previous: number): { sign: string; pct: number } | null {
  if (previous <= 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { sign: pct >= 0 ? "+" : "", pct: Math.round(pct) };
}

export async function BentoHomeWeekly({
  userId,
  layout = "grid",
}: {
  userId: string;
  layout?: "grid" | "row";
}) {
  const { from, to } = currentWeekRange();
  const prevFrom = new Date(from);
  prevFrom.setDate(prevFrom.getDate() - 7);
  const prevTo = from;

  const [rows, prevRows] = await Promise.all([
    db
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
      ),
    db
      .select({
        distance: activities.distance,
        duration: activities.duration,
      })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          gte(activities.startTime, prevFrom),
          lt(activities.startTime, prevTo)
        )
      ),
  ]);

  const count = rows.length;
  const distance = rows.reduce((s, r) => s + (r.distance ?? 0), 0);
  const duration = rows.reduce((s, r) => s + (r.duration ?? 0), 0);

  const prevCount = prevRows.length;
  const prevDistance = prevRows.reduce((s, r) => s + (r.distance ?? 0), 0);
  const prevDuration = prevRows.reduce((s, r) => s + (r.duration ?? 0), 0);

  const weekNo = isoWeek(from);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
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
      <div
        className={
          layout === "row"
            ? "grid grid-cols-3 gap-6 flex-1 content-center"
            : "grid grid-cols-2 gap-3 flex-1 content-center"
        }
      >
        <Stat
          icon={<Activity className="h-3 w-3" />}
          label="Aktiv."
          value={String(count)}
          delta={delta(count, prevCount)}
        />
        <Stat
          icon={<Ruler className="h-3 w-3" />}
          label="Distanz"
          value={distance > 0 ? formatDistanceKm(distance) : "–"}
          unit="km"
          delta={delta(distance, prevDistance)}
        />
        {(() => {
          const d = duration > 0 ? formatDurationHm(duration) : { value: "–", unit: "" };
          return (
            <Stat
              icon={<Clock className="h-3 w-3" />}
              label="Zeit"
              value={d.value}
              unit={d.unit || undefined}
              delta={delta(duration, prevDuration)}
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
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  delta?: { sign: string; pct: number } | null;
}) {
  const isNumeric = /^[0-9'.:-]+$/.test(value);
  return (
    <div>
      <div
        className={`flex items-center gap-1 ${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] mb-1`}
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
      {delta != null && (
        <div
          className={`${spaceMono.className} text-[9px] font-bold tabular-nums tracking-[0.08em] mt-1`}
          style={{ color: delta.pct >= 0 ? UP : DOWN }}
        >
          {delta.sign}
          {delta.pct} %
        </div>
      )}
    </div>
  );
}
