"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
}

interface ActivityChartProps {
  routeData: RoutePoint[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
  totalDistance?: number | null;
  isRunning?: boolean;
  startTime?: Date | string | null;
  duration?: number | null;
  showHr: boolean;
  showSpeed: boolean;
  onHoverIdx: (idx: number | null) => void;
  sunrise?: Date | null;
  sunset?: Date | null;
}

function estimateDistance(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const R = 6371;
    const dLat = ((points[i].lat - points[i - 1].lat) * Math.PI) / 180;
    const dLon = ((points[i].lng - points[i - 1].lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((points[i - 1].lat * Math.PI) / 180) *
        Math.cos((points[i].lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

export function ActivityChart({
  routeData,
  heartRateData,
  speedData,
  totalDistance,
  isRunning = false,
  startTime,
  duration,
  showHr,
  showSpeed,
  onHoverIdx,
  sunrise,
  sunset,
}: ActivityChartProps) {
  const chartData = useMemo(() => {
    const route = routeData.filter((d) => d.elevation != null);
    if (route.length === 0) return [];
    const totalKm = totalDistance
      ? totalDistance / 1000
      : estimateDistance(route);
    const n = route.length;
    const hrLen = heartRateData.length;
    const spLen = speedData.length;
    const startMs = startTime ? new Date(startTime).getTime() : null;
    return route.map((d, i) => {
      const ratio = i / Math.max(1, n - 1);
      const hrIdx = hrLen > 0 ? Math.min(hrLen - 1, Math.round(ratio * (hrLen - 1))) : -1;
      const spIdx = spLen > 0 ? Math.min(spLen - 1, Math.round(ratio * (spLen - 1))) : -1;
      const hr = hrIdx >= 0 ? heartRateData[hrIdx]?.bpm : null;
      const sp = spIdx >= 0 ? speedData[spIdx]?.speed : null;
      const pace = isRunning && sp != null && sp > 0 ? 60 / sp : null;
      const sourceTime =
        (hrIdx >= 0 && heartRateData[hrIdx]?.time) ||
        (spIdx >= 0 && speedData[spIdx]?.time) ||
        null;
      let timeLabel: string | null = null;
      if (sourceTime) {
        timeLabel = new Date(sourceTime).toLocaleTimeString("de-CH", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (startMs != null && duration) {
        timeLabel = new Date(startMs + ratio * duration * 1000).toLocaleTimeString(
          "de-CH",
          { hour: "2-digit", minute: "2-digit" }
        );
      }
      const tsMs = sourceTime
        ? new Date(sourceTime).getTime()
        : startMs != null && duration
          ? startMs + ratio * duration * 1000
          : null;
      return {
        routeIdx: i,
        distance: Math.round(totalKm * ratio * 100) / 100,
        elevation: Math.round(d.elevation!),
        bpm: hr,
        speed: isRunning ? pace : sp,
        time: timeLabel,
        tsMs,
      };
    });
  }, [routeData, heartRateData, speedData, totalDistance, isRunning, startTime, duration]);

  if (chartData.length === 0) return null;

  const findDistanceAt = (target: Date | null | undefined): number | null => {
    if (!target) return null;
    const tMs = target.getTime();
    const first = chartData[0].tsMs;
    const last = chartData[chartData.length - 1].tsMs;
    if (first == null || last == null) return null;
    if (tMs < first || tMs > last) return null;
    let lo = 0;
    let hi = chartData.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const v = chartData[mid].tsMs;
      if (v == null || v < tMs) lo = mid + 1;
      else hi = mid;
    }
    return chartData[lo].distance;
  };
  const sunriseX = findDistanceAt(sunrise ?? null);
  const sunsetX = findDistanceAt(sunset ?? null);
  const formatTime = (d: Date) =>
    d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });

  const formatSpeed = (v: number) => {
    if (isRunning) {
      const m = Math.floor(v);
      const s = Math.round((v - m) * 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return v.toFixed(1);
  };

  const HoverTooltip = (props: {
    active?: boolean;
    payload?: Array<{ payload?: { routeIdx?: number; time?: string | null } }>;
    label?: number | string;
  }) => {
    const { active, payload, label } = props;
    const idx = active && payload && payload[0]?.payload?.routeIdx;
    const lastIdxRef = useRef<number | null>(null);
    useEffect(() => {
      const next = typeof idx === "number" ? idx : null;
      if (next !== lastIdxRef.current) {
        lastIdxRef.current = next;
        onHoverIdx(next);
      }
    });
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        className="rounded-lg border bg-background text-foreground shadow-md"
        style={{ padding: "6px 10px", fontSize: 12 }}
      >
        <div style={{ marginBottom: 4, fontWeight: 500 }}>
          {label} km
          {payload[0]?.payload?.time ? ` · ${payload[0].payload.time}` : ""}
        </div>
        {payload.map((p) => {
          const item = p as unknown as {
            name?: string;
            value?: number;
            color?: string;
          };
          if (item.value == null) return null;
          let txt = String(item.value);
          if (item.name === "Höhe") txt = `${item.value} m`;
          else if (item.name === "Puls") txt = `${item.value} bpm`;
          else if (item.name === "Pace")
            txt = `${formatSpeed(item.value)} min/km`;
          else if (item.name === "Speed")
            txt = `${formatSpeed(item.value)} km/h`;
          return (
            <div key={item.name} style={{ color: item.color }}>
              {item.name}: {txt}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        onMouseLeave={() => onHoverIdx(null)}
      >
        <defs>
          <linearGradient id="eleGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="distance"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v} km`}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="ele"
          domain={["dataMin - 20", "dataMax + 20"]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={42}
          tickFormatter={(v) => `${v}m`}
        />
        {showHr && (
          <YAxis
            yAxisId="hr"
            orientation="right"
            domain={["dataMin - 10", "dataMax + 10"]}
            tick={{ fontSize: 11, fill: "#e11d48" }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `${v}`}
          />
        )}
        {showSpeed && (
          <YAxis
            yAxisId="speed"
            orientation="right"
            domain={["auto", "auto"]}
            reversed={isRunning}
            tick={{ fontSize: 11, fill: "#3b82f6" }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => formatSpeed(v)}
          />
        )}
        <Tooltip content={<HoverTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {sunriseX != null && sunrise && (
          <ReferenceLine
            yAxisId="ele"
            x={sunriseX}
            stroke="#eab308"
            strokeDasharray="2 4"
            strokeWidth={1}
            label={{
              value: `☀ ${formatTime(sunrise)}`,
              position: "top",
              fontSize: 10,
              fill: "#a16207",
            }}
          />
        )}
        {sunsetX != null && sunset && (
          <ReferenceLine
            yAxisId="ele"
            x={sunsetX}
            stroke="#6366f1"
            strokeDasharray="2 4"
            strokeWidth={1}
            label={{
              value: `🌙 ${formatTime(sunset)}`,
              position: "top",
              fontSize: 10,
              fill: "#4338ca",
            }}
          />
        )}
        <Area
          yAxisId="ele"
          type="monotone"
          dataKey="elevation"
          name="Höhe"
          stroke="#22c55e"
          strokeWidth={1.5}
          fill="url(#eleGradient)"
          dot={false}
          isAnimationActive={false}
        />
        {showHr && (
          <Line
            yAxisId="hr"
            type="monotone"
            dataKey="bpm"
            name="Puls"
            stroke="#e11d48"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
        {showSpeed && (
          <Line
            yAxisId="speed"
            type="monotone"
            dataKey="speed"
            name={isRunning ? "Pace" : "Speed"}
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
