import { Calendar } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { HeatmapGrid } from "./heatmap-grid";

const NEON = "#FF6A00";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function intensityBucket(trimp: number): number {
  if (trimp <= 0) return 0;
  if (trimp < 50) return 1;
  if (trimp < 100) return 2;
  if (trimp < 200) return 3;
  return 4;
}

const BUCKET_COLORS = ["#0a0a0a", "#2a1609", "#6b3a18", "#b35c22", NEON];
const bucketColor = (b: number) => BUCKET_COLORS[b] ?? BUCKET_COLORS[0];

const WEEKDAYS = ["Mo", "Mi", "Fr"];

export async function BentoDashboardHeatmap({ userId }: { userId: string }) {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 371);
  // Roll back `from` to Monday for clean grid start
  const dayOfWeek = (from.getDay() + 6) % 7; // 0 = Mon
  from.setDate(from.getDate() - dayOfWeek);

  const rows = await db
    .select({
      startTime: activities.startTime,
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

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey(r.startTime);
    byDay.set(k, (byDay.get(k) ?? 0) + (r.trimp ?? 0));
  }

  type Day = {
    key: string;
    date: Date;
    dateIso: string;
    bucket: number;
    trimp: number;
    isToday: boolean;
  };
  const days: Day[] = [];
  const d = new Date(from);
  const today = dayKey(now);
  while (d < to) {
    const k = dayKey(d);
    const trimp = byDay.get(k) ?? 0;
    days.push({
      key: k,
      date: new Date(d),
      dateIso: new Date(d).toISOString(),
      bucket: intensityBucket(trimp),
      trimp,
      isToday: k === today,
    });
    d.setDate(d.getDate() + 1);
  }

  // Chunk into weeks (columns), each 7 days (rows Mon–Sun)
  const weeks: Day[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const activeDays = days.filter((x) => x.bucket > 0).length;
  const totalTrimp = Math.round(days.reduce((s, x) => s + x.trimp, 0));

  const CELL_W = 6;
  const CELL_H = 14;
  const GAP = 1;

  // Month labels: show month abbr at the top of first week of each month
  const monthLabels: { col: number; label: string }[] = [];
  const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  weeks.forEach((w, col) => {
    const first = w[0];
    if (!first) return;
    const prevCol = col - 1;
    const prev = prevCol >= 0 ? weeks[prevCol][0] : null;
    if (!prev || prev.date.getMonth() !== first.date.getMonth()) {
      monthLabels.push({ col, label: MONTHS[first.date.getMonth()] });
    }
  });

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Calendar className="h-3 w-3" style={{ color: NEON }} />
          Aktivitäts-Jahr
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#9ca3af] tabular-nums`}
        >
          {activeDays} aktive Tage · TRIMP {totalTrimp.toLocaleString("de-CH")}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="inline-block">
          {/* Month labels */}
          <div
            className="relative"
            style={{
              height: 12,
              marginLeft: 20,
              width: weeks.length * (CELL_W + GAP),
            }}
          >
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className={`${spaceMono.className} absolute text-[9px] font-bold uppercase tracking-[0.1em] text-[#a3a3a3]`}
                style={{ left: m.col * (CELL_W + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex items-start gap-1">
            {/* Weekday labels */}
            <div
              className="flex flex-col justify-between"
              style={{ height: 7 * (CELL_H + GAP) - GAP, paddingTop: 2 }}
            >
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className={`${spaceMono.className} text-[8px] font-bold uppercase tracking-[0.1em] text-[#4a4a4a]`}
                  style={{ lineHeight: 1 }}
                >
                  {w}
                </span>
              ))}
            </div>
            {/* Interactive grid */}
            <HeatmapGrid
              weeks={weeks}
              bucketColors={BUCKET_COLORS}
              cellW={CELL_W}
              cellH={CELL_H}
              gap={GAP}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span
          className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3]`}
        >
          letzte 52 Wochen
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3]`}
          >
            Weniger
          </span>
          {[0, 1, 2, 3, 4].map((b) => (
            <span
              key={b}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: bucketColor(b),
              }}
            />
          ))}
          <span
            className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3]`}
          >
            Mehr
          </span>
        </div>
      </div>
    </div>
  );
}
