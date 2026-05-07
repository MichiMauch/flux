import { Activity } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { MonthLineChart } from "./month-line-chart";
import { getMonthlyActivities } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";
const LINE = "#00D4FF";

export async function BentoDashboardMonthlyActivities({ userId }: { userId: string }) {
  const { counts, total, currentMonth } = await getMonthlyActivities(userId);

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
        currentMonth={currentMonth}
        formattedValues={counts.map((v) => String(v))}
        unit="Aktiv."
      />
    </div>
  );
}
