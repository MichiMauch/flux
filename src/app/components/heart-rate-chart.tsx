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

interface HeartRateChartProps {
  data: { time: string; bpm: number }[];
}

export function HeartRateChart({ data }: HeartRateChartProps) {
  const avg = Math.round(data.reduce((s, d) => s + d.bpm, 0) / data.length);

  const chartData = data.map((d, i) => ({
    index: i,
    bpm: d.bpm,
    time: new Date(d.time).toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
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
          domain={["dataMin - 10", "dataMax + 10"]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip
          formatter={(value) => [`${value} bpm`, "Puls"]}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <ReferenceLine
          y={avg}
          stroke="#e11d48"
          strokeDasharray="3 3"
          strokeOpacity={0.5}
          label={{ value: `Ø ${avg}`, position: "right", fontSize: 11 }}
        />
        <Area
          type="monotone"
          dataKey="bpm"
          stroke="#e11d48"
          strokeWidth={1.5}
          fill="url(#hrGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
