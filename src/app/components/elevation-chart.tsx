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
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ElevationChart({ data }: ElevationChartProps) {
  const withElevation = data.filter((d) => d.elevation != null);
  if (withElevation.length === 0) return null;

  let cumulativeDistance = 0;
  const chartData = withElevation.map((d, i) => {
    if (i > 0) {
      cumulativeDistance += haversine(
        withElevation[i - 1].lat,
        withElevation[i - 1].lng,
        d.lat,
        d.lng
      );
    }
    return {
      distance: Math.round(cumulativeDistance / 10) / 100, // km with 2 decimals
      elevation: Math.round(d.elevation!),
    };
  });

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
