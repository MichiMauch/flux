"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface MonthlyChartProps {
  data: {
    month: string;
    distance: number;
    ascent: number;
    count: number;
  }[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data}>
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}m`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              distance: "Distanz",
              ascent: "Höhenmeter",
              count: "Aktivitäten",
            };
            const units: Record<string, string> = {
              distance: "km",
              ascent: "m",
              count: "",
            };
            return [
              `${value} ${units[name as string] ?? ""}`,
              labels[name as string] ?? name,
            ];
          }}
        />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = { distance: "Distanz (km)", ascent: "Höhenmeter", count: "Aktivitäten" };
            return labels[value] ?? value;
          }}
        />
        <Bar
          yAxisId="left"
          dataKey="distance"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          dataKey="ascent"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
