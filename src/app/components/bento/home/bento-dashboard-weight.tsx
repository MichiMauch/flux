import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { db } from "@/lib/db";
import { weightMeasurements } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";
import { WeightSparkline } from "./weight-sparkline";

const NEON = "#FF6A00";
const UP = "#FF6A00";
const DOWN = "#39FF14";

export async function BentoDashboardWeight({ userId }: { userId: string }) {
  const rows = await db
    .select({
      date: weightMeasurements.date,
      weight: weightMeasurements.weight,
      bmi: weightMeasurements.bmi,
    })
    .from(weightMeasurements)
    .where(eq(weightMeasurements.userId, userId))
    .orderBy(desc(weightMeasurements.date))
    .limit(20);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <Scale className="h-3 w-3" style={{ color: NEON }} />
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
          >
            Gewicht
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

  const latest = rows[0];
  const previous = rows[1];
  const deltaRaw = previous ? latest.weight - previous.weight : null;
  const arrow =
    deltaRaw == null
      ? null
      : deltaRaw > 0.05
        ? "up"
        : deltaRaw < -0.05
          ? "down"
          : "flat";

  // Sparkline — reverse so chronological left→right
  const points = [...rows].reverse().map((r) => ({ date: r.date, weight: r.weight }));

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Scale className="h-3 w-3" style={{ color: NEON }} />
          Gewicht
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums`}
        >
          {new Date(latest.date).toLocaleDateString("de-CH", {
            day: "2-digit",
            month: "short",
          })}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="flex items-baseline gap-2" style={{ fontSize: "36px" }}>
          <SevenSegDisplay value={latest.weight.toFixed(1)} />
          <span
            className={`${spaceMono.className} text-[0.36em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            kg
          </span>
        </div>
        {deltaRaw != null && arrow && (
          <div
            className={`${spaceMono.className} inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-1 rounded`}
            style={{
              color:
                arrow === "up" ? UP : arrow === "down" ? DOWN : "#a3a3a3",
              background:
                arrow === "up"
                  ? `${UP}1a`
                  : arrow === "down"
                    ? `${DOWN}1a`
                    : "#1a1a1a",
              textShadow:
                arrow === "flat"
                  ? undefined
                  : `0 0 6px ${arrow === "up" ? UP : DOWN}88`,
            }}
          >
            {arrow === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : arrow === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {deltaRaw > 0 ? "+" : ""}
            {deltaRaw.toFixed(1)} kg
          </div>
        )}
      </div>
      <WeightSparkline points={points} />
      {latest.bmi != null && (
        <div
          className={`${spaceMono.className} text-[10px] text-[#a3a3a3] tabular-nums uppercase tracking-[0.1em] mt-2`}
        >
          BMI <span className="text-white font-bold">{latest.bmi.toFixed(1)}</span>
          <span className="text-[#3a3a3a] mx-2">·</span>
          {rows.length} Messungen
        </div>
      )}
    </div>
  );
}
