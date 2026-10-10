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

const SERIES: Record<string, { label: string; unit: string; order: number }> = {
  systolic: { label: "Systolisch", unit: "mmHg", order: 0 },
  diastolic: { label: "Diastolisch", unit: "mmHg", order: 1 },
  pulse: { label: "Puls", unit: "bpm", order: 2 },
};

// Recharts sorts tooltip and legend entries alphabetically by default.
const seriesOrder = (item: { dataKey?: unknown }) =>
  SERIES[String(item.dataKey)]?.order ?? 99;

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
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            backgroundColor: "#18181b",
            border: "1px solid #3f3f46",
          }}
          labelStyle={{ color: "#d4d4d8" }}
          itemSorter={seriesOrder}
          formatter={(value, name) => {
            const series = SERIES[name as string];
            return series
              ? [`${value} ${series.unit}`, series.label]
              : [`${value}`, name];
          }}
        />
        <Legend
          itemSorter={seriesOrder}
          formatter={(value) => SERIES[value]?.label ?? value}
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
