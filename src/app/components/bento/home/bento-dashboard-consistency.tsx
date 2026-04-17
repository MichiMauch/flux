import { Calendar } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { dayKey, isoWeek, startOfWeek } from "@/lib/activity-week";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { WeeklyBarsScope, type WeekBar } from "./weekly-bars-scope";

const NEON = "#FF6A00";
const OK = "#39FF14";
const WARN = "#FFD700";
const BAD = "#FF3B30";

function daysBetween(a: Date, b: Date): number {
  const dayMs = 86400000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const db2 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((da - db2) / dayMs);
}

export async function BentoDashboardConsistency({ userId }: { userId: string }) {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);

  const rows = await db
    .select({ startTime: activities.startTime })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), gte(activities.startTime, jan1))
    );

  const activeDays = new Set<string>();
  let latest: Date | null = null;
  for (const r of rows) {
    activeDays.add(dayKey(r.startTime));
    if (!latest || r.startTime.getTime() > latest.getTime()) latest = r.startTime;
  }

  const daysSinceLast = latest ? daysBetween(now, latest) : null;
  const daysYtd = daysBetween(now, jan1) + 1;
  const activeCount = activeDays.size;
  const activeRate = daysYtd > 0 ? (activeCount / daysYtd) * 100 : 0;

  const sinceColor =
    daysSinceLast == null
      ? "#a3a3a3"
      : daysSinceLast === 0
        ? OK
        : daysSinceLast <= 2
          ? "#ffffff"
          : daysSinceLast <= 4
            ? WARN
            : BAD;

  // Weekly buckets for last 12 weeks
  const WEEKS = 12;
  const weekStarts: Date[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(startOfWeek(d));
  }
  const weeks: WeekBar[] = weekStarts.map((ws) => {
    const weekEnd = new Date(ws);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = rows.filter(
      (r) => r.startTime >= ws && r.startTime < weekEnd
    ).length;
    return {
      start: ws.toISOString(),
      count,
      week: isoWeek(ws),
    };
  });
  const maxWeek = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Calendar className="h-3 w-3" style={{ color: NEON }} />
          Konsistenz
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{ color: NEON }}
        >
          KW {isoWeek(now)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 items-start">
        <div>
          <div
            className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] mb-1`}
          >
            seit letzter Aktiv.
          </div>
          <div className="flex items-baseline gap-2" style={{ fontSize: "40px" }}>
            <SevenSegDisplay
              value={daysSinceLast != null ? String(daysSinceLast) : "-"}
              on={sinceColor}
            />
            <span
              className={`${spaceMono.className} text-[0.3em] font-bold lowercase`}
              style={{ color: sinceColor }}
            >
              {daysSinceLast === 1 ? "tag" : "tage"}
            </span>
          </div>
        </div>
        <div>
          <div
            className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] mb-1`}
          >
            aktiv-quote
          </div>
          <div className="flex items-baseline gap-2" style={{ fontSize: "40px" }}>
            <SevenSegDisplay value={String(Math.round(activeRate))} />
            <span
              className={`${spaceMono.className} text-[0.3em] font-bold lowercase`}
              style={{ color: NEON }}
            >
              %
            </span>
          </div>
          <div
            className={`${spaceMono.className} text-[9px] text-[#a3a3a3] mt-1 tabular-nums uppercase tracking-[0.1em]`}
          >
            {activeCount} / {daysYtd} Tage
          </div>
        </div>
      </div>

      <div className="mt-auto pt-3">
        <div
          className={`flex items-baseline justify-between mb-1 ${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums`}
        >
          <span>Akt. / Woche · {WEEKS} Wochen</span>
          <span style={{ color: NEON }}>Max {maxWeek}</span>
        </div>
        <WeeklyBarsScope weeks={weeks} maxWeek={maxWeek} />
      </div>
    </div>
  );
}
