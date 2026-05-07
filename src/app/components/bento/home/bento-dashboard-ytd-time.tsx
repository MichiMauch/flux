import { Clock } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { getYtdTime } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";

export async function BentoDashboardYtdTime({ userId }: { userId: string }) {
  const { secYtd, secLastYear, latestSec: lastSec, year } = await getYtdTime(userId);
  const hoursYtd = secYtd / 3600;
  const hoursLast = secLastYear / 3600;
  const lifeDays = hoursYtd / 24;
  const lastLabel = (() => {
    if (lastSec == null || lastSec <= 0) return null;
    const h = Math.floor(lastSec / 3600);
    const m = Math.round((lastSec % 3600) / 60);
    if (h === 0) return `${m} min`;
    return `${h}h ${m.toString().padStart(2, "0")}min`;
  })();
  const deltaPct = hoursLast > 0 ? ((hoursYtd - hoursLast) / hoursLast) * 100 : null;
  const deltaColor = deltaPct == null
    ? "#a3a3a3"
    : deltaPct >= 0
      ? "#39FF14"
      : "#FF3B30";
  const deltaSign = deltaPct != null && deltaPct >= 0 ? "+" : "";

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3 h-full flex flex-col">
      <div className="flex items-center mb-1">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Clock className="h-3 w-3" style={{ color: NEON }} />
          Zeit · {year}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1.5" style={{ fontSize: "44px" }}>
          <SevenSegDisplay value={Math.round(hoursYtd).toLocaleString("de-CH")} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            h
          </span>
        </div>
      </div>

      {lastLabel && (
        <div
          className={`${spaceMono.className} text-[10px] font-bold tabular-nums text-center`}
          style={{ color: NEON }}
        >
          + {lastLabel}
        </div>
      )}

      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3] tabular-nums mt-1 text-center`}
      >
        {deltaPct != null && (
          <>
            <span style={{ color: deltaColor }}>
              {deltaSign}
              {Math.round(deltaPct)} %
            </span>
            <span className="mx-1">·</span>
          </>
        )}
        <span style={{ color: NEON }}>{lifeDays.toFixed(1)}</span> Tage
      </div>
    </div>
  );
}
