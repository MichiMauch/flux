"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

interface ElevationChartProps {
  data: { lat: number; lng: number; elevation?: number | null }[];
  totalDistance?: number | null; // meters
}

export function ElevationChart({ data, totalDistance }: ElevationChartProps) {
  const withElevation = data.filter((d) => d.elevation != null);
  if (withElevation.length === 0) return null;

  // Use total distance from activity (accurate) and distribute proportionally
  const totalKm = totalDistance
    ? totalDistance / 1000
    : estimateDistance(withElevation);

  const chartData = withElevation.map((d, i) => ({
    distance:
      Math.round((totalKm * (i / (withElevation.length - 1))) * 100) / 100,
    elevation: Math.round(d.elevation!),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
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
          domain={["dataMin - 20", "dataMax + 20"]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => `${v}m`}
        />
        <Tooltip
          formatter={(value) => [`${value} m`, "Höhe"]}
          labelFormatter={(v) => `${v} km`}
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#22c55e"
          strokeWidth={1.5}
          fill="url(#eleGradient)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function estimateDistance(
  points: { lat: number; lng: number }[]
): number {
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
