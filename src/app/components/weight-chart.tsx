"use client";

import { useState, useTransition } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { setTargetWeight } from "@/app/health/actions";

interface WeightChartProps {
  data: {
    /** Messzeitpunkt als Unix-Timestamp (ms) */
    t: number;
    weight: number;
    fatMass?: number | null;
  }[];
  initialTargetWeight?: number | null;
}

const DAY_MS = 86_400_000;
/** Mindest-Prognosehorizont, wenn kein Zielgewicht gesetzt ist */
const PROJECTION_DAYS = 42; // 6 Wochen
/** Obergrenze für den Prognosehorizont (verhindert absurde Achsen bei flachem Trend) */
const MAX_PROJECTION_DAYS = 730;

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString("de-CH");

export function WeightChart({ data, initialTargetWeight }: WeightChartProps) {
  const [showTrend, setShowTrend] = useState(true);
  const [target, setTarget] = useState<number | null>(
    initialTargetWeight ?? null
  );
  const [draft, setDraft] = useState(
    initialTargetWeight != null ? String(initialTargetWeight) : ""
  );
  const [, startTransition] = useTransition();

  const hasFatMass = data.some((d) => d.fatMass != null);

  // Punkte chronologisch sortieren (Regression + Projektion brauchen echte Zeit)
  const points = [...data].sort((a, b) => a.t - b.t);

  // Regression auf Basis von Tagen seit erstem Messpunkt
  const t0 = points.length > 0 ? points[0].t : 0;
  const reg = linearRegression(
    points.map((d) => ({ x: (d.t - t0) / DAY_MS, y: d.weight }))
  );
  const trendAt = (t: number) =>
    reg ? reg.intercept + reg.slope * ((t - t0) / DAY_MS) : null;

  const lastT = points.length > 0 ? points[points.length - 1].t : 0;
  const currentTrend = trendAt(lastT);

  // Wann wird das Zielgewicht erreicht, wenn der Trend so weitergeht?
  type TargetInfo =
    | { status: "reachable"; t: number; days: number }
    | { status: "reached" }
    | { status: "wrong-direction" }
    | { status: "flat" };
  let targetInfo: TargetInfo | null = null;
  if (reg && target != null && currentTrend != null) {
    if (Math.abs(reg.slope) < 1e-6) {
      targetInfo = { status: "flat" };
    } else {
      const movingDown = reg.slope < 0;
      const reached = movingDown ? target >= currentTrend : target <= currentTrend;
      if (reached) {
        targetInfo = { status: "reached" };
      } else {
        const dayOfTarget = (target - reg.intercept) / reg.slope;
        const tTarget = t0 + dayOfTarget * DAY_MS;
        const days = Math.round((tTarget - lastT) / DAY_MS);
        targetInfo =
          days > 0
            ? { status: "reachable", t: tTarget, days }
            : { status: "wrong-direction" };
      }
    }
  }

  // Prognosehorizont: bis zum Ziel (falls erreichbar), sonst Standard
  let horizonDays = PROJECTION_DAYS;
  if (targetInfo?.status === "reachable") {
    horizonDays = Math.min(
      Math.max(PROJECTION_DAYS, targetInfo.days + 7),
      MAX_PROJECTION_DAYS
    );
  }

  // Echte Messpunkte (mit Trendwert) + ggf. Prognosepunkte in die Zukunft
  const chartData: {
    t: number;
    weight: number | null;
    fatMass?: number | null;
    trend: number | null;
  }[] = points.map((d) => ({
    t: d.t,
    weight: d.weight,
    fatMass: d.fatMass,
    trend: trendAt(d.t),
  }));

  if (showTrend && reg) {
    for (let day = 7; day <= horizonDays; day += 7) {
      const t = lastT + day * DAY_MS;
      chartData.push({ t, weight: null, fatMass: null, trend: trendAt(t) });
    }
  }

  // kg pro Woche (negativ = Abnahme) für die Legende
  const perWeek = reg ? reg.slope * 7 : 0;
  const trendLabel = reg
    ? `Prognose (${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(2)} kg/Woche)`
    : "Prognose";

  const seriesLabels: Record<string, string> = {
    weight: "Gewicht",
    fatMass: "Fettmasse",
    trend: trendLabel,
  };

  const showGoal = showTrend && target != null;
  const yMin = (dataMin: number) =>
    Math.floor((showGoal ? Math.min(dataMin, target!) : dataMin) - 2);
  const yMax = (dataMax: number) =>
    Math.ceil((showGoal ? Math.max(dataMax, target!) : dataMax) + 2);

  function commitTarget() {
    const raw = draft.trim().replace(",", ".");
    const parsed = raw === "" ? null : parseFloat(raw);
    const normalized =
      parsed != null && Number.isFinite(parsed) && parsed > 0
        ? Math.round(parsed * 10) / 10
        : null;
    setTarget(normalized);
    setDraft(normalized != null ? String(normalized) : "");
    startTransition(() => {
      setTargetWeight(normalized);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setShowTrend((v) => !v)}
          aria-pressed={showTrend}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
            showTrend
              ? "border-[#38bdf8]/50 bg-[#38bdf8]/10 text-[#38bdf8]"
              : "border-[#2a2a2a] bg-black/40 text-[#9ca3af] hover:text-white"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              showTrend ? "bg-[#38bdf8]" : "bg-[#52525b]"
            }`}
          />
          Trendlinie
        </button>

        <label className="flex items-center gap-2 text-xs text-[#9ca3af]">
          <span>Zielgewicht</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTarget}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="kg"
            className="w-20 rounded-md border border-[#2a2a2a] bg-black/40 px-2 py-1 text-right text-white outline-none focus:border-[#22c55e]/60"
          />
          <span>kg</span>
        </label>

        {showTrend && targetInfo && (
          <span className="text-xs text-[#9ca3af]">
            {targetInfo.status === "reachable" && (
              <>
                Ziel erreicht am{" "}
                <span className="font-semibold text-[#22c55e]">
                  {fmtDate(targetInfo.t)}
                </span>{" "}
                <span className="text-[#6b7280]">
                  (in {targetInfo.days}{" "}
                  {targetInfo.days === 1 ? "Tag" : "Tagen"})
                </span>
              </>
            )}
            {targetInfo.status === "reached" && (
              <span className="font-semibold text-[#22c55e]">
                Ziel bereits erreicht 🎉
              </span>
            )}
            {targetInfo.status === "wrong-direction" && (
              <>Mit dem aktuellen Trend nicht erreichbar.</>
            )}
            {targetInfo.status === "flat" && (
              <>Kein klarer Trend – Ziel-Datum nicht berechenbar.</>
            )}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtDate}
              tick={{ fontSize: 11, fill: "#d4d4d8" }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: "#d4d4d8" }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={(v) => Number(v).toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
              }}
              labelStyle={{ color: "#d4d4d8" }}
              itemStyle={{ color: "#fafafa" }}
              labelFormatter={(t) => fmtDate(Number(t))}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)} kg`,
                seriesLabels[name as string] ?? name,
              ]}
            />
            <Legend
              formatter={(value) => seriesLabels[value as string] ?? value}
            />
            {showGoal && (
              <ReferenceLine
                y={target!}
                stroke="#22c55e"
                strokeDasharray="4 4"
                label={{
                  value: `Ziel ${target!.toFixed(1)} kg`,
                  position: "insideBottomLeft",
                  fill: "#22c55e",
                  fontSize: 10,
                }}
              />
            )}
            {showGoal && targetInfo?.status === "reachable" && (
              <ReferenceLine
                x={targetInfo.t}
                stroke="#22c55e"
                strokeDasharray="2 3"
                label={{
                  value: fmtDate(targetInfo.t),
                  position: "insideTopRight",
                  fill: "#22c55e",
                  fontSize: 10,
                }}
              />
            )}
            {showTrend && reg && (
              <ReferenceLine
                x={lastT}
                stroke="#52525b"
                strokeDasharray="2 3"
                label={{
                  value: "heute",
                  position: "insideTopRight",
                  fill: "#a1a1aa",
                  fontSize: 10,
                }}
              />
            )}
            {showTrend && reg && (
              <Line
                type="linear"
                dataKey="trend"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
                connectNulls
              />
            )}
            <Line
              type="monotone"
              dataKey="weight"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            {hasFatMass && (
              <Line
                type="monotone"
                dataKey="fatMass"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
