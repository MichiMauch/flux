"use client";

import { useMemo, useRef } from "react";
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
  CartesianGrid,
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

function HoverTooltipContent({
  active,
  payload,
  label,
  isRunning,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: { time?: string | null; elapsedSec?: number | null };
  }>;
  label?: number | string;
  isRunning?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const meta = payload[0]?.payload;
  const fmtSpeed = (v: number) => {
    if (isRunning) {
      const m = Math.floor(v);
      const s = Math.round((v - m) * 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return v.toFixed(1);
  };
  return (
    <div
      className="rounded-lg border bg-background text-foreground shadow-md"
      style={{ padding: "6px 10px", fontSize: 12 }}
    >
      <div style={{ marginBottom: 4, fontWeight: 500 }}>
        {label} km
        {meta?.time ? ` · ${meta.time}` : ""}
        {meta?.elapsedSec != null ? ` · +${formatElapsed(meta.elapsedSec)}` : ""}
      </div>
      {payload.map((item) => {
        if (item.value == null) return null;
        let txt = String(item.value);
        if (item.name === "Höhe") txt = `${item.value} m`;
        else if (item.name === "Puls") txt = `${item.value} bpm`;
        else if (item.name === "Pace") txt = `${fmtSpeed(item.value)} min/km`;
        else if (item.name === "Speed") txt = `${fmtSpeed(item.value)} km/h`;
        return (
          <div key={item.name} style={{ color: item.color }}>
            {item.name}: {txt}
          </div>
        );
      })}
    </div>
  );
}

function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
    // First-sample base time for elapsed calculation
    const firstSourceTime =
      (hrLen > 0 && heartRateData[0]?.time) ||
      (spLen > 0 && speedData[0]?.time) ||
      null;
    const baseMs = firstSourceTime ? new Date(firstSourceTime).getTime() : startMs;
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
      const elapsedSec =
        tsMs != null && baseMs != null ? Math.max(0, (tsMs - baseMs) / 1000) : null;
      return {
        routeIdx: i,
        distance: Math.round(totalKm * ratio * 100) / 100,
        elevation: Math.round(d.elevation!),
        bpm: hr,
        speed: isRunning ? pace : sp,
        time: timeLabel,
        tsMs,
        elapsedSec,
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

  // X-axis: fixed 2 km steps
  const totalKm = chartData[chartData.length - 1]?.distance ?? 0;
  const X_STEP = 2;
  const xTicks: number[] = [];
  for (let v = 0; v <= totalKm + 0.0001; v += X_STEP) {
    xTicks.push(Math.round(v * 10) / 10);
  }

  // Y-axis: evenly spaced elevation ticks with rounded step
  const elevations = chartData.map((d) => d.elevation);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const range = maxEle - minEle;
  const yStep = (() => {
    if (range <= 50) return 10;
    if (range <= 150) return 25;
    if (range <= 400) return 50;
    if (range <= 800) return 100;
    if (range <= 2000) return 250;
    return 500;
  })();
  const yMin = Math.floor(minEle / yStep) * yStep;
  const yMax = Math.ceil(maxEle / yStep) * yStep;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 0.0001; v += yStep) yTicks.push(v);

  const formatSpeed = (v: number) => {
    if (isRunning) {
      const m = Math.floor(v);
      const s = Math.round((v - m) * 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return v.toFixed(1);
  };

  const lastHoverIdxRef = useRef<number | null>(null);
  const handleMouseMove = (state: unknown) => {
    const raw = (state as { activeTooltipIndex?: number | string | null } | null | undefined)
      ?.activeTooltipIndex;
    const i = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : null;
    const idx =
      i != null && Number.isFinite(i) && i >= 0 && i < chartData.length
        ? chartData[i].routeIdx
        : null;
    if (idx !== lastHoverIdxRef.current) {
      lastHoverIdxRef.current = idx;
      onHoverIdx(idx);
    }
  };
  const handleMouseLeave = () => {
    if (lastHoverIdxRef.current !== null) {
      lastHoverIdxRef.current = null;
      onHoverIdx(null);
    }
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="eleGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid
          yAxisId="ele"
          stroke="var(--muted-foreground)"
          strokeDasharray="2 3"
          strokeOpacity={0.35}
          vertical
          horizontal
        />
        <XAxis
          dataKey="distance"
          type="number"
          domain={[0, totalKm]}
          ticks={xTicks}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v} km`}
        />
        <YAxis
          yAxisId="ele"
          domain={[yMin, yMax]}
          ticks={yTicks}
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
        <Tooltip content={<HoverTooltipContent isRunning={isRunning} />} />
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
