import { isYearRange, type TimeRange } from "./filters";

export type DailyBucket = "daily" | "weekly" | "monthly";
type DateScalar = string | Date | null | undefined;

function toDateKey(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d;
}

/** Pick the natural bucket granularity for a daily-level chart in a range. */
export function pickDailyBucket(range: TimeRange): DailyBucket {
  if (isYearRange(range)) return "weekly";
  if (range === "30d" || range === "90d") return "daily";
  if (range === "ytd" || range === "12m") return "weekly";
  return "monthly";
}

/** Convert an ISO date (YYYY-MM-DD) into the selected bucket key. */
export function bucketKey(date: string, bucket: DailyBucket): string {
  if (bucket === "daily") return date;
  const d = new Date(date + "T00:00:00Z");
  if (bucket === "monthly") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTH_SHORT_DE = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

/** Human-readable label for a bucket key: "12.04", "KW15", "Apr 26". */
export function bucketLabel(raw: string, bucket: DailyBucket): string {
  if (bucket === "daily") {
    const [, mm, dd] = raw.split("-");
    return `${dd}.${mm}`;
  }
  if (bucket === "weekly") {
    const parts = raw.split("-W");
    return `KW${parts[1] ?? ""}`;
  }
  const [y, mo] = raw.split("-");
  return `${MONTH_SHORT_DE[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
}

/** Aggregate a series of rows by bucket (avg or sum). */
export function aggregateSeries<T>(
  rows: T[],
  getDate: (row: T) => DateScalar,
  getValue: (row: T) => number | null | undefined,
  bucket: DailyBucket,
  mode: "avg" | "sum" = "avg"
): { key: string; value: number }[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const ds = getDate(row);
    if (!ds) continue;
    const date = toDateKey(ds);
    const v = getValue(row);
    if (v == null || Number.isNaN(v)) continue;
    const key = bucketKey(date, bucket);
    const prev = map.get(key) ?? { sum: 0, count: 0 };
    prev.sum += v;
    prev.count += 1;
    map.set(key, prev);
  }
  const keys = Array.from(map.keys()).sort();
  return keys.map((k) => {
    const e = map.get(k)!;
    return { key: k, value: mode === "avg" ? e.sum / e.count : e.sum };
  });
}
