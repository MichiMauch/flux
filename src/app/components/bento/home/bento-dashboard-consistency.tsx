import { Calendar } from "lucide-react";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { WeeklyBarsScope } from "./weekly-bars-scope";
import { getConsistency } from "@/lib/cache/home-stats";

const NEON = "#FF6A00";
const OK = "#39FF14";
const WARN = "#FFD700";
const BAD = "#FF3B30";

const WEEKS = 12;

export async function BentoDashboardConsistency({ userId }: { userId: string }) {
  const { daysSinceLast, activeCount, daysYtd, weeks, weekNo } =
    await getConsistency(userId);
  const activeRate = daysYtd > 0 ? (activeCount / daysYtd) * 100 : 0;
  const maxWeek = Math.max(...weeks.map((w) => w.count), 1);

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
          KW {weekNo}
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
