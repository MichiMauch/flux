"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface SpeedChartProps {
  data: { time: string; speed: number }[];
  isRunning?: boolean;
}

export function SpeedChart({ data, isRunning = false }: SpeedChartProps) {
  const chartData = data.map((d, i) => {
    const speed = d.speed;
    // Pace = min/km (only for running, invert speed)
    const pace = isRunning && speed > 0 ? 60 / speed : null;
    return {
      index: i,
      value: isRunning ? pace : speed,
      time: d.time
        ? new Date(d.time).toLocaleTimeString("de-CH", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : String(i),
    };
  });

  const values = chartData.map((d) => d.value).filter((v): v is number => v != null && v > 0);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  const color = "#3b82f6";
  const label = isRunning ? "Pace" : "km/h";
  const unit = isRunning ? "min/km" : "km/h";

  const formatValue = (v: number) => {
    if (isRunning) {
      const m = Math.floor(v);
      const s = Math.round((v - m) * 60);
      return `${m}:${s.toString().padStart(2, "0")}`;
    }
    return v.toFixed(1);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={35}
          reversed={isRunning}
          tickFormatter={(v) => formatValue(v)}
        />
        <Tooltip
          formatter={(value) => [`${formatValue(value as number)} ${unit}`, label]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <ReferenceLine
          y={avg}
          stroke={color}
          strokeDasharray="3 3"
          strokeOpacity={0.5}
          label={{
            value: `Ø ${formatValue(avg)}`,
            position: "right",
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill="url(#speedGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
