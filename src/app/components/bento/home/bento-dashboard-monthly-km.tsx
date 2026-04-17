import { Ruler } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { MonthLineChart } from "./month-line-chart";

const NEON = "#FF6A00";

export async function BentoDashboardMonthlyKm({ userId }: { userId: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const rows = await db
    .select({
      startTime: activities.startTime,
      distance: activities.distance,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  const km: number[] = Array.from({ length: 12 }, () => 0);
  for (const a of rows) km[a.startTime.getMonth()] += (a.distance ?? 0) / 1000;
  const totalKm = km.reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Ruler className="h-3 w-3" style={{ color: NEON }} />
          km / Monat
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{ color: NEON }}
        >
          Σ {Math.round(totalKm).toLocaleString("de-CH")} km
        </span>
      </div>
      <MonthLineChart
        values={km}
        color={NEON}
        currentMonth={now.getMonth()}
        formattedValues={km.map((v) =>
          v >= 100 ? Math.round(v).toLocaleString("de-CH") : v.toFixed(1)
        )}
        unit="km"
      />
    </div>
  );
}
