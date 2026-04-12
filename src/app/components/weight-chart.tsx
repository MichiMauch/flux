"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface WeightChartProps {
  data: {
    date: string;
    weight: number;
    fatMass?: number | null;
  }[];
}

export function WeightChart({ data }: WeightChartProps) {
  const hasFatMass = data.some((d) => d.fatMass != null);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={["dataMin - 2", "dataMax + 2"]}
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
              weight: "Gewicht",
              fatMass: "Fettmasse",
            };
            return [`${Number(value).toFixed(1)} kg`, labels[name as string] ?? name];
          }}
        />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = {
              weight: "Gewicht",
              fatMass: "Fettmasse",
            };
            return labels[value] ?? value;
          }}
        />
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
  );
}
