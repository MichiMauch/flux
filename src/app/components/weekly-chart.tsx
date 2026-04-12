"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface WeeklyChartProps {
  data: { week: string; distance: number; duration: number; count: number }[];
}

export function WeeklyChart({ data }: WeeklyChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={35}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              distance: "Distanz",
              duration: "Dauer",
            };
            const units: Record<string, string> = {
              distance: "km",
              duration: "min",
            };
            return [
              `${value} ${units[name as string] ?? ""}`,
              labels[name as string] ?? name,
            ];
          }}
        />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = { distance: "Distanz (km)", duration: "Dauer (min)" };
            return labels[value] ?? value;
          }}
        />
        <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="duration" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
