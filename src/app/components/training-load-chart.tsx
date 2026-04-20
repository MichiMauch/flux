"use client";

import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { TrainingLoadPoint } from "@/lib/training-load";

const NEON = "#FF6A00";
const CTL_COLOR = "#60A5FA"; // blue — Fitness
const ATL_COLOR = "#F472B6"; // pink — Ermüdung
const FRESH_FILL = "#22C55E"; // green — CTL > ATL
const TIRED_FILL = "#F97316"; // orange — ATL > CTL

interface Props {
  data: TrainingLoadPoint[];
}

interface BandPoint extends TrainingLoadPoint {
  freshBand: [number, number] | null;
  tiredBand: [number, number] | null;
}

function formatTick(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "short" });
}

export function TrainingLoadChart({ data }: Props) {
  if (data.length === 0) return null;

  // Split the CTL/ATL gap into a green "fresh" band and orange "tired" band.
  const banded: BandPoint[] = data.map((p) => ({
    ...p,
    freshBand: p.ctl > p.atl ? [p.atl, p.ctl] : null,
    tiredBand: p.atl > p.ctl ? [p.ctl, p.atl] : null,
  }));

  const trimpMax = Math.max(...data.map((p) => p.trimp), 50);
  const loadMax = Math.max(...data.map((p) => Math.max(p.ctl, p.atl)), 50);
  const leftMax = Math.max(loadMax * 1.1, trimpMax * 1.1);

  const tickStep = Math.max(1, Math.floor(data.length / 8));
  const xTicks = data
    .filter((_, i) => i % tickStep === 0 || i === data.length - 1)
    .map((p) => p.date);

  return (
    <div className="flex h-full flex-col">
      <LegendRow />
      <div className="flex-1 min-h-0">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={banded}
        margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
      >
        <CartesianGrid stroke="#2a2a2a" strokeDasharray="2 4" vertical={false} />

        <XAxis
          dataKey="date"
          ticks={xTicks}
          tickFormatter={formatTick}
          tick={{ fontSize: 10, fill: "#a3a3a3" }}
          stroke="#3a3a3a"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />

        <YAxis
          domain={[0, Math.ceil(leftMax / 10) * 10]}
          tick={{ fontSize: 10, fill: "#a3a3a3" }}
          stroke="#3a3a3a"
          tickLine={false}
          axisLine={false}
          width={34}
        />

        <Tooltip
          cursor={{ stroke: NEON, strokeOpacity: 0.4, strokeDasharray: "2 2" }}
          contentStyle={{
            background: "rgba(0,0,0,0.92)",
            border: `1px solid ${NEON}55`,
            borderRadius: 8,
            fontSize: 12,
            color: "#fff",
            boxShadow: `0 0 12px ${NEON}33`,
          }}
          labelFormatter={(label) =>
            typeof label === "string"
              ? new Date(label).toLocaleDateString("de-CH", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : String(label ?? "")
          }
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              trimp: "TRIMP",
              ctl: "Fitness",
              atl: "Ermüdung",
            };
            if (name === "freshBand" || name === "tiredBand") {
              return [null, null] as unknown as [string, string];
            }
            const n = typeof value === "number" ? value : Number(value ?? 0);
            const key = typeof name === "string" ? name : String(name ?? "");
            return [n.toFixed(1), labels[key] ?? key];
          }}
        />
        {/* Green band where Fitness > Ermüdung (good) */}
        <Area
          dataKey="freshBand"
          fill={FRESH_FILL}
          fillOpacity={0.22}
          stroke="none"
          connectNulls={false}
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />

        {/* Orange band where Ermüdung > Fitness (loaded) */}
        <Area
          dataKey="tiredBand"
          fill={TIRED_FILL}
          fillOpacity={0.22}
          stroke="none"
          connectNulls={false}
          isAnimationActive={false}
          activeDot={false}
        />

        <Bar
          dataKey="trimp"
          fill={NEON}
          fillOpacity={0.4}
          isAnimationActive={false}
          maxBarSize={6}
        />
        <Line
          type="monotone"
          dataKey="ctl"
          stroke={CTL_COLOR}
          strokeWidth={2.2}
          dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="atl"
          stroke={ATL_COLOR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendRow() {
  const items = [
    { label: "Fitness", color: CTL_COLOR, kind: "line" as const },
    { label: "Ermüdung", color: ATL_COLOR, kind: "line" as const },
    { label: "Frisch", color: FRESH_FILL, kind: "fill" as const },
    { label: "Belastet", color: TIRED_FILL, kind: "fill" as const },
    { label: "TRIMP", color: NEON, kind: "bar" as const },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 text-[11px] text-[#d4d4d4]">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.kind === "line" ? (
            <span
              className="inline-block h-[2px] w-4 rounded-full"
              style={{ background: it.color }}
            />
          ) : it.kind === "fill" ? (
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: it.color, opacity: 0.55 }}
            />
          ) : (
            <span
              className="inline-block h-3 w-1.5 rounded-sm"
              style={{ background: it.color, opacity: 0.7 }}
            />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}
