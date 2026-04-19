import {
  Activity as ActivityIcon,
  Clock,
  Flame,
  Mountain,
  Ruler,
} from "lucide-react";
import type { LinePoint } from "../components/stats/line-scope";
import type { MultiSeries } from "../components/stats/multi-line-scope";
import type { BarPoint } from "../components/stats/bars-scope";
import type { DonutSlice } from "../components/stats/donut-scope";
import type { StatsKpi } from "./stats-kpi-grid";
import type { TimeRange } from "./filters";
import { rangeLabel, sportLabel } from "./filters";
import {
  aggregateSeries,
  bucketKey,
  bucketLabel,
  type DailyBucket,
} from "./bucket-utils";
import {
  formatDistanceAuto,
  formatDurationHmSuffix as formatDuration,
} from "@/lib/activity-format";
import {
  CYAN,
  MAGENTA,
  NEON,
  PURPLE,
  RED,
  sportColor,
} from "@/lib/sport-colors";

const formatDistanceKm0 = (m: number) => formatDistanceAuto(m, 0);

type BucketGranularity = "daily" | "weekly" | "monthly";

interface TimeSeriesRow {
  bucket: string;
  totalDistance: number;
  totalDuration: number;
}

interface SleepRow {
  date: string | Date;
  score: number | null;
  deepSec: number | null;
  lightSec: number | null;
  remSec: number | null;
  unrecognizedSec: number | null;
  totalSleepSec: number | null;
}

interface RechargeRow {
  date: string | Date;
  hrv: number | null;
  ansCharge: number | null;
}

interface WeightRow {
  date: string | Date;
  weight: number | null;
}

interface BpRow {
  measuredAt: Date | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
}

interface DailyRow {
  date: string | Date;
  steps: number | null;
}

export function buildKpis(totals: {
  count: number;
  totalDistance: number;
  totalDuration: number;
  totalAscent: number;
  totalCalories: number;
}): StatsKpi[] {
  return [
    { icon: ActivityIcon, label: "Aktiv.", value: `${totals.count}`, color: NEON },
    { icon: Ruler, label: "Distanz", value: formatDistanceKm0(totals.totalDistance), color: NEON },
    { icon: Clock, label: "Dauer", value: formatDuration(totals.totalDuration), color: NEON },
    {
      icon: Mountain,
      label: "Hm",
      value: `${Math.round(totals.totalAscent).toLocaleString("de-CH")} m`,
      color: NEON,
    },
    {
      icon: Flame,
      label: "kcal",
      value: Math.round(totals.totalCalories).toLocaleString("de-CH"),
      color: NEON,
    },
  ];
}

export function buildSportSlices(
  bySport: { type: string; count: number; totalDistance: number }[]
): DonutSlice[] {
  return bySport.map((s, i) => ({
    label: sportLabel(s.type),
    value: s.totalDistance,
    color: sportColor(s.type, i),
    secondary: `${s.count}× · ${formatDistanceKm0(s.totalDistance)}`,
  }));
}

export function buildStatsLabels(
  range: TimeRange,
  sport: string | null,
  bucket: DailyBucket,
  dailyBucket: DailyBucket
): {
  activityTile: string;
  bucketSuffix: string;
  stepsTitle: string;
} {
  const rangeLbl = rangeLabel(range);
  const sportLbl = sport ? sportLabel(sport) : null;
  const activityTile = sportLbl
    ? `Aktivitäten · ${rangeLbl} · ${sportLbl}`
    : `Aktivitäten · ${rangeLbl}`;
  const bucketSuffix =
    bucket === "daily"
      ? "pro Tag"
      : bucket === "weekly"
        ? "pro Woche"
        : "pro Monat";
  const stepsTitle =
    dailyBucket === "daily"
      ? "Schritte pro Tag"
      : dailyBucket === "weekly"
        ? "Schritte · Ø pro Woche"
        : "Schritte · Ø pro Monat";
  return { activityTile, bucketSuffix, stepsTitle };
}

export function buildActivityBars(
  timeSeries: TimeSeriesRow[],
  bucket: BucketGranularity
): { distance: BarPoint[]; duration: BarPoint[] } {
  const distance: BarPoint[] = timeSeries.map((t) => ({
    label: bucketLabel(t.bucket, bucket),
    value: Math.round(t.totalDistance / 1000),
    formatted: `${(t.totalDistance / 1000).toFixed(1)}`,
  }));
  const duration: BarPoint[] = timeSeries.map((t) => ({
    label: bucketLabel(t.bucket, bucket),
    value: Math.round(t.totalDuration / 60),
    formatted: formatDuration(t.totalDuration),
  }));
  return { distance, duration };
}

export function buildSleepChartData(
  sleep: SleepRow[],
  dailyBucket: DailyBucket
): { line: LinePoint[]; phases: DonutSlice[]; avgSleepCenter: string } {
  const sleepAgg = aggregateSeries(
    sleep,
    (r) => r.date,
    (r) => r.score,
    dailyBucket,
    "avg"
  );
  const line: LinePoint[] = sleepAgg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value),
  }));

  const phaseTotals = sleep.reduce(
    (acc, r) => {
      acc.deep += r.deepSec ?? 0;
      acc.light += r.lightSec ?? 0;
      acc.rem += r.remSec ?? 0;
      acc.unknown += r.unrecognizedSec ?? 0;
      return acc;
    },
    { deep: 0, light: 0, rem: 0, unknown: 0 }
  );
  const phases: DonutSlice[] = [
    { label: "Deep", value: phaseTotals.deep, color: PURPLE },
    { label: "REM", value: phaseTotals.rem, color: MAGENTA },
    { label: "Light", value: phaseTotals.light, color: CYAN },
    { label: "Unerkannt", value: phaseTotals.unknown, color: "#4a5568" },
  ];

  const sleepDurations = sleep
    .map((r) => r.totalSleepSec)
    .filter((v): v is number => v != null);
  const avgSec =
    sleepDurations.length > 0
      ? sleepDurations.reduce((s, v) => s + v, 0) / sleepDurations.length
      : 0;
  const h = Math.floor(avgSec / 3600);
  const m = Math.floor((avgSec % 3600) / 60);
  const avgSleepCenter =
    avgSec > 0 ? `${h}:${String(m).padStart(2, "0")}` : "-";

  return { line, phases, avgSleepCenter };
}

export function buildRecoverySeries(
  recharge: RechargeRow[],
  dailyBucket: DailyBucket
): { labels: string[]; series: MultiSeries[] } {
  const hrvAgg = aggregateSeries(
    recharge,
    (r) => r.date,
    (r) => r.hrv,
    dailyBucket,
    "avg"
  );
  const ansAgg = aggregateSeries(
    recharge,
    (r) => r.date,
    (r) => r.ansCharge,
    dailyBucket,
    "avg"
  );
  const hrvMap = new Map(hrvAgg.map((a) => [a.key, a.value]));
  const ansMap = new Map(ansAgg.map((a) => [a.key, a.value]));
  const keys = Array.from(
    new Set([...hrvAgg.map((a) => a.key), ...ansAgg.map((a) => a.key)])
  )
    .filter((k) => hrvMap.has(k) && ansMap.has(k))
    .sort();
  if (keys.length === 0) return { labels: [], series: [] };

  const labels = keys.map((k) => bucketLabel(k, dailyBucket));
  const series: MultiSeries[] = [
    {
      name: "HRV",
      color: CYAN,
      unit: "ms",
      values: keys.map((k) => Math.round(hrvMap.get(k) ?? NaN)),
    },
    {
      name: "ANS",
      color: NEON,
      unit: "",
      values: keys.map(
        (k) => Math.round((ansMap.get(k) ?? NaN) * 10) / 10
      ),
    },
  ];
  return { labels, series };
}

export function buildWeightLine(
  weight: WeightRow[],
  dailyBucket: DailyBucket
): LinePoint[] {
  const agg = aggregateSeries(
    weight,
    (r) => r.date,
    (r) => r.weight,
    dailyBucket,
    "avg"
  );
  return agg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value * 10) / 10,
    formatted: `${(Math.round(a.value * 10) / 10).toFixed(1)}`,
  }));
}

export function buildBpSeries(
  bp: BpRow[],
  dailyBucket: DailyBucket
): { labels: string[]; series: MultiSeries[] } {
  const rows = bp.filter(
    (r) => r.measuredAt != null && r.systolic != null && r.diastolic != null
  );
  const map = new Map<
    string,
    { sys: number; dia: number; pulse: number; pulseN: number; n: number }
  >();
  for (const r of rows) {
    const isoDate = r.measuredAt!.toISOString().slice(0, 10);
    const key = bucketKey(isoDate, dailyBucket);
    const prev = map.get(key) ?? {
      sys: 0,
      dia: 0,
      pulse: 0,
      pulseN: 0,
      n: 0,
    };
    prev.sys += r.systolic ?? 0;
    prev.dia += r.diastolic ?? 0;
    if (r.pulse != null) {
      prev.pulse += r.pulse;
      prev.pulseN += 1;
    }
    prev.n += 1;
    map.set(key, prev);
  }
  const keys = Array.from(map.keys()).sort();
  if (keys.length === 0) return { labels: [], series: [] };

  const labels = keys.map((k) => bucketLabel(k, dailyBucket));
  const series: MultiSeries[] = [
    {
      name: "Sys",
      color: RED,
      unit: "mmHg",
      values: keys.map((k) => Math.round(map.get(k)!.sys / map.get(k)!.n)),
    },
    {
      name: "Dia",
      color: NEON,
      unit: "mmHg",
      values: keys.map((k) => Math.round(map.get(k)!.dia / map.get(k)!.n)),
    },
    {
      name: "Puls",
      color: CYAN,
      unit: "bpm",
      values: keys.map((k) => {
        const e = map.get(k)!;
        return e.pulseN > 0 ? Math.round(e.pulse / e.pulseN) : 0;
      }),
    },
  ];
  return { labels, series };
}

export function buildStepsBars(
  daily: DailyRow[],
  dailyBucket: DailyBucket
): BarPoint[] {
  const agg = aggregateSeries(
    daily,
    (r) => r.date,
    (r) => r.steps,
    dailyBucket,
    dailyBucket === "daily" ? "sum" : "avg"
  );
  return agg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value),
    formatted: Math.round(a.value).toLocaleString("de-CH"),
  }));
}
