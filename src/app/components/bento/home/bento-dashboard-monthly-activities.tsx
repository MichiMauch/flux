import { Activity } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { MonthLineChart } from "./month-line-chart";

const NEON = "#FF6A00";
const LINE = "#00D4FF";

export async function BentoDashboardMonthlyActivities({ userId }: { userId: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const rows = await db
    .select({ startTime: activities.startTime })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  const counts: number[] = Array.from({ length: 12 }, () => 0);
  for (const a of rows) counts[a.startTime.getMonth()] += 1;
  const total = counts.reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Activity className="h-3 w-3" style={{ color: NEON }} />
          Aktivitäten / Monat
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{ color: LINE }}
        >
          Σ {total}
        </span>
      </div>
      <MonthLineChart
        values={counts}
        color={LINE}
        currentMonth={now.getMonth()}
        formattedValues={counts.map((v) => String(v))}
        unit="Aktiv."
      />
    </div>
  );
}
