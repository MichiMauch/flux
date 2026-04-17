export type TimeRange =
  | "ytd"
  | "30d"
  | "90d"
  | "12m"
  | "all"
  | `year:${number}`;

export const PRESET_RANGES: { value: TimeRange; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "30d", label: "30 Tage" },
  { value: "90d", label: "90 Tage" },
  { value: "ytd", label: "YTD" },
  { value: "12m", label: "12 Monate" },
];

export const DEFAULT_RANGE: TimeRange = "all";

export function parseRange(v: string | undefined | null): TimeRange {
  if (!v) return DEFAULT_RANGE;
  if (v.startsWith("year:")) {
    const y = parseInt(v.slice(5), 10);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) {
      return `year:${y}` as TimeRange;
    }
    return DEFAULT_RANGE;
  }
  const allowed = ["ytd", "30d", "90d", "12m", "all"];
  return allowed.includes(v) ? (v as TimeRange) : DEFAULT_RANGE;
}

export function parseSport(v: string | undefined | null): string | null {
  if (!v || v === "all") return null;
  return v;
}

export function isYearRange(r: TimeRange): r is `year:${number}` {
  return typeof r === "string" && r.startsWith("year:");
}

export function yearOf(r: TimeRange): number | null {
  if (!isYearRange(r)) return null;
  return parseInt(r.slice(5), 10);
}

export function rangeBounds(range: TimeRange): {
  start: Date | null;
  end: Date | null;
} {
  if (isYearRange(range)) {
    const y = yearOf(range)!;
    return {
      start: new Date(Date.UTC(y, 0, 1)),
      end: new Date(Date.UTC(y + 1, 0, 1)),
    };
  }
  const now = new Date();
  switch (range) {
    case "30d":
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: null,
      };
    case "90d":
      return {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        end: null,
      };
    case "12m":
      return {
        start: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
        end: null,
      };
    case "ytd":
      return { start: new Date(now.getFullYear(), 0, 1), end: null };
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function rangeLabel(range: TimeRange): string {
  if (isYearRange(range)) return String(yearOf(range));
  return PRESET_RANGES.find((r) => r.value === range)?.label ?? "";
}

export function sportLabel(type: string): string {
  const t = type.toUpperCase();
  if (t === "RUNNING") return "Laufen";
  if (t === "CYCLING") return "Rad";
  if (t === "ROAD_BIKING") return "Rennrad";
  if (t === "MOUNTAIN_BIKING") return "MTB";
  if (t === "INDOOR_CYCLING") return "Indoor Rad";
  if (t === "WALKING") return "Gehen";
  if (t === "HIKING") return "Wandern";
  if (t === "SWIMMING") return "Schwimmen";
  if (t === "YOGA") return "Yoga";
  if (t === "PILATES") return "Pilates";
  if (t === "OTHER_INDOOR") return "Indoor";
  if (t === "OTHER_OUTDOOR") return "Outdoor";
  return type;
}
