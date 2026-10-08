import { APP_TIME_ZONE, formatDurationHMS } from "@/lib/activity-format";
import type { StoryStat } from "./story-designs";

export function metricValue(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return value.toLocaleString("de-CH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDistance(distance: number | null): string {
  if (distance == null || !Number.isFinite(distance)) return "–";
  return (distance / 1000).toFixed(distance >= 10000 ? 1 : 2);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("de-CH", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Die Werte der Story-Karten. Aufstieg nur bei Sportarten mit Gelände. */
export function buildStoryStats(
  a: {
    distance: number | null;
    movingTime: number | null;
    duration: number | null;
    ascent: number | null;
  },
  terrain: boolean
): StoryStat[] {
  const stats: StoryStat[] = [
    { label: "Distanz", value: formatDistance(a.distance), unit: "km" },
    { label: "Zeit", value: formatDurationHMS(a.movingTime ?? a.duration ?? 0) },
  ];
  if (terrain) {
    stats.push({ label: "Aufstieg", value: metricValue(a.ascent), unit: "m" });
  }
  return stats;
}
