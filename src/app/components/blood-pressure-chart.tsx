"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  Legend,
} from "recharts";

interface BloodPressureChartProps {
  data: {
    date: string;
    systolic: number;
    diastolic: number;
    pulse: number;
  }[];
}

export function BloodPressureChart({ data }: BloodPressureChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        {/* Normal range bands */}
        <ReferenceArea
          y1={90}
          y2={120}
          fill="#22c55e"
          fillOpacity={0.08}
          label={{ value: "Normal (sys)", position: "insideTopRight", fontSize: 10, fill: "#22c55e" }}
        />
        <ReferenceArea
          y1={60}
          y2={80}
          fill="#3b82f6"
          fillOpacity={0.08}
          label={{ value: "Normal (dia)", position: "insideBottomRight", fontSize: 10, fill: "#3b82f6" }}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[40, 180]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              systolic: "Systolisch",
              diastolic: "Diastolisch",
              pulse: "Puls",
            };
            return [`${value}`, labels[name as string] ?? name];
          }}
        />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = {
              systolic: "Systolisch",
              diastolic: "Diastolisch",
              pulse: "Puls",
            };
            return labels[value] ?? value;
          }}
        />
        <Line
          type="monotone"
          dataKey="systolic"
          stroke="#e11d48"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="diastolic"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="pulse"
          stroke="#a855f7"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
