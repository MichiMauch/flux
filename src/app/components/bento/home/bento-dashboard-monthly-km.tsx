import { Ruler } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { MonthLineChart } from "./month-line-chart";
import { getMonthlyKm } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";

export async function BentoDashboardMonthlyKm({ userId }: { userId: string }) {
  const { km, totalKm, currentMonth } = await getMonthlyKm(userId);

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
        currentMonth={currentMonth}
        formattedValues={km.map((v) =>
          v >= 100 ? Math.round(v).toLocaleString("de-CH") : v.toFixed(1)
        )}
        unit="km"
      />
    </div>
  );
}
