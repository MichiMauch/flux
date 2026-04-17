import { HeartPulse } from "lucide-react";
import { db } from "@/lib/db";
import { bloodPressureSessions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

/**
 * ESH/ESC 2024 classification for adult office BP.
 * Returns label + color (neon palette).
 */
function classify(systolic: number, diastolic: number): {
  label: string;
  color: string;
  short: string;
} {
  if (systolic < 120 && diastolic < 80) {
    return { label: "Optimal", color: "#39FF14", short: "OPT" };
  }
  if (systolic < 130 && diastolic < 85) {
    return { label: "Normal", color: "#00D4FF", short: "NORM" };
  }
  if (systolic < 140 && diastolic < 90) {
    return { label: "Hoch-Normal", color: "#FFD700", short: "HOCH-N" };
  }
  if (systolic < 160 && diastolic < 100) {
    return { label: "Hypertonie Stufe 1", color: "#FF9500", short: "HTN 1" };
  }
  if (systolic < 180 && diastolic < 110) {
    return { label: "Hypertonie Stufe 2", color: "#FF6A00", short: "HTN 2" };
  }
  return { label: "Hypertonie Stufe 3", color: "#FF3030", short: "HTN 3" };
}

export async function BentoDashboardBp({ userId }: { userId: string }) {
  const [latest] = await db
    .select({
      date: bloodPressureSessions.date,
      measuredAt: bloodPressureSessions.measuredAt,
      systolicAvg: bloodPressureSessions.systolicAvg,
      diastolicAvg: bloodPressureSessions.diastolicAvg,
      pulseAvg: bloodPressureSessions.pulseAvg,
    })
    .from(bloodPressureSessions)
    .where(eq(bloodPressureSessions.userId, userId))
    .orderBy(desc(bloodPressureSessions.measuredAt))
    .limit(1);

  if (!latest) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <HeartPulse className="h-3 w-3" style={{ color: NEON }} />
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
          >
            Blutdruck
          </span>
        </div>
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#a3a3a3]`}
        >
          Keine Messung
        </div>
      </div>
    );
  }

  const cls = classify(latest.systolicAvg, latest.diastolicAvg);
  const dateLabel = (latest.measuredAt ?? new Date(latest.date)).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
  });

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <HeartPulse className="h-3 w-3" style={{ color: NEON }} />
          Blutdruck
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums`}
        >
          {dateLabel}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="flex items-baseline gap-2" style={{ fontSize: "28px" }}>
          <SevenSegDisplay value={String(Math.round(latest.systolicAvg))} />
          <span
            className={`${spaceMono.className} text-[0.4em] font-bold`}
            style={{ color: "#3a3a3a" }}
          >
            /
          </span>
          <SevenSegDisplay value={String(Math.round(latest.diastolicAvg))} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            mmhg
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 gap-2">
        <span
          className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded truncate`}
          style={{
            color: cls.color,
            background: `${cls.color}1a`,
            border: `1px solid ${cls.color}55`,
            textShadow: `0 0 6px ${cls.color}88`,
          }}
        >
          {cls.short}
        </span>
        {latest.pulseAvg != null && (
          <span
            className={`${spaceMono.className} text-[10px] font-bold text-[#9ca3af] tabular-nums uppercase tracking-[0.1em]`}
          >
            ♥ {Math.round(latest.pulseAvg)}
          </span>
        )}
      </div>
    </div>
  );
}
