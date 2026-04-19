import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Ruler,
  Clock,
  Mountain,
  Flame,
  Activity as ActivityIcon,
} from "lucide-react";
import { BentoPageShell } from "../components/bento/bento-page-shell";
import { BentoPageHeader } from "../components/bento/bento-page-header";
import { BentoTile } from "../components/bento/bento-tile";
import { spaceMono } from "../components/bento/bento-fonts";
import { LedValue } from "../components/bento/led-value";
import { LineScope, type LinePoint } from "../components/stats/line-scope";
import {
  MultiLineScope,
  type MultiSeries,
} from "../components/stats/multi-line-scope";
import { BarsScope, type BarPoint } from "../components/stats/bars-scope";
import { DonutScope, type DonutSlice } from "../components/stats/donut-scope";
import { StatsFilterBar } from "./stats-filter-bar";
import {
  parseRange,
  parseSport,
  rangeLabel,
  sportLabel,
  isYearRange,
  type TimeRange,
} from "./filters";
import {
  getActivityTotals,
  getActivitiesBySport,
  getAvailableSports,
  getAvailableYears,
  getActivitiesTimeSeries,
  getSleepData,
  getRechargeData,
  getWeightData,
  getBloodPressureData,
  getDailyActivityData,
  pickBucket,
} from "./data";
import { formatDurationHmSuffix as formatDuration } from "@/lib/activity-format";

const NEON = "#FF6A00";
const CYAN = "#00D4FF";
const GREEN = "#39FF14";
const YELLOW = "#FFD700";
const RED = "#FF3B30";
const MAGENTA = "#FF4DD2";

const SPORT_COLORS: Record<string, string> = {
  RUNNING: NEON,
  CYCLING: CYAN,
  ROAD_BIKING: CYAN,
  MOUNTAIN_BIKING: "#00A8FF",
  INDOOR_CYCLING: "#4DDCFF",
  SWIMMING: "#00A8FF",
  WALKING: GREEN,
  HIKING: YELLOW,
  YOGA: MAGENTA,
  PILATES: "#FF8FD6",
  OTHER_INDOOR: MAGENTA,
  OTHER_OUTDOOR: "#8A2BE2",
};

function sportColor(type: string, fallbackIdx = 0): string {
  if (SPORT_COLORS[type]) return SPORT_COLORS[type];
  const palette = [NEON, CYAN, GREEN, YELLOW, "#8A2BE2", MAGENTA, "#00A8FF"];
  return palette[fallbackIdx % palette.length];
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(0)} km`;
}

function bucketLabel(raw: string, bucket: "daily" | "weekly" | "monthly"): string {
  if (bucket === "daily") {
    // raw = YYYY-MM-DD
    const [, mm, dd] = raw.split("-");
    return `${dd}.${mm}`;
  }
  if (bucket === "weekly") {
    // raw = IYYY-WIW (e.g. "2026-W15")
    const parts = raw.split("-W");
    return `KW${parts[1] ?? ""}`;
  }
  // monthly: YYYY-MM
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const [y, mo] = raw.split("-");
  return `${months[parseInt(mo, 10) - 1]} ${y.slice(2)}`;
}

type DateScalar = string | Date | null | undefined;

function toDateKey(d: string | Date): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d;
}

type DailyBucket = "daily" | "weekly" | "monthly";

function pickDailyBucket(range: TimeRange): DailyBucket {
  if (isYearRange(range)) return "weekly";
  if (range === "30d" || range === "90d") return "daily";
  if (range === "ytd" || range === "12m") return "weekly";
  return "monthly";
}

function bucketKey(date: string, bucket: DailyBucket): string {
  if (bucket === "daily") return date;
  const d = new Date(date + "T00:00:00Z");
  if (bucket === "monthly") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  // weekly: ISO week
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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

function aggregateSeries<T>(
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

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sport?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const range = parseRange(params.range);
  const sport = parseSport(params.sport);
  const bucket = pickBucket(range);
  const dailyBucket = pickDailyBucket(range);

  const [
    availableSports,
    availableYears,
    totals,
    bySport,
    timeSeries,
    sleep,
    recharge,
    weight,
    bp,
    daily,
  ] = await Promise.all([
    getAvailableSports(userId),
    getAvailableYears(userId),
    getActivityTotals(userId, range, sport),
    getActivitiesBySport(userId, range),
    getActivitiesTimeSeries(userId, range, sport, bucket),
    getSleepData(userId, range),
    getRechargeData(userId, range),
    getWeightData(userId, range),
    getBloodPressureData(userId, range),
    getDailyActivityData(userId, range),
  ]);

  // ── Aktivitäten KPI ───────────────────────────────────────────────
  const kpis = [
    {
      icon: ActivityIcon,
      label: "Aktiv.",
      value: `${totals.count}`,
      color: NEON,
    },
    {
      icon: Ruler,
      label: "Distanz",
      value: formatDistance(totals.totalDistance),
      color: NEON,
    },
    {
      icon: Clock,
      label: "Dauer",
      value: formatDuration(totals.totalDuration),
      color: NEON,
    },
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

  // ── Sport donut ───────────────────────────────────────────────────
  const sportSlices: DonutSlice[] = bySport.map((s, i) => ({
    label: sportLabel(s.type),
    value: s.totalDistance,
    color: sportColor(s.type, i),
    secondary: `${s.count}× · ${formatDistance(s.totalDistance)}`,
  }));

  // ── Activity time series (bars) ───────────────────────────────────
  const distanceBars: BarPoint[] = timeSeries.map((t) => ({
    label: bucketLabel(t.bucket, bucket),
    value: Math.round(t.totalDistance / 1000),
    formatted: `${(t.totalDistance / 1000).toFixed(1)}`,
  }));
  const durationBars: BarPoint[] = timeSeries.map((t) => ({
    label: bucketLabel(t.bucket, bucket),
    value: Math.round(t.totalDuration / 60),
    formatted: formatDuration(t.totalDuration),
  }));

  // ── Sleep score ───────────────────────────────────────────────────
  const sleepAgg = aggregateSeries(
    sleep,
    (r) => r.date,
    (r) => r.score,
    dailyBucket,
    "avg"
  );
  const sleepLine: LinePoint[] = sleepAgg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value),
  }));

  // Sleep phase donut (averages across the range)
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
  const phaseSlices: DonutSlice[] = [
    { label: "Deep", value: phaseTotals.deep, color: "#8A2BE2" },
    { label: "REM", value: phaseTotals.rem, color: MAGENTA },
    { label: "Light", value: phaseTotals.light, color: CYAN },
    { label: "Unerkannt", value: phaseTotals.unknown, color: "#4a5568" },
  ];

  // Avg sleep hours for center
  const sleepDurAgg = sleep
    .map((r) => r.totalSleepSec)
    .filter((v): v is number => v != null);
  const avgSleepSec =
    sleepDurAgg.length > 0
      ? sleepDurAgg.reduce((s, v) => s + v, 0) / sleepDurAgg.length
      : 0;
  const avgSleepH = Math.floor(avgSleepSec / 3600);
  const avgSleepM = Math.floor((avgSleepSec % 3600) / 60);
  const avgSleepCenter =
    avgSleepSec > 0
      ? `${avgSleepH}:${String(avgSleepM).padStart(2, "0")}`
      : "-";

  // ── Recovery (HRV + ANS) ──────────────────────────────────────────
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
  // Align labels: only keys where both series have values
  const hrvMap = new Map(hrvAgg.map((a) => [a.key, a.value]));
  const ansMap = new Map(ansAgg.map((a) => [a.key, a.value]));
  const recoveryLabels = Array.from(
    new Set([...hrvAgg.map((a) => a.key), ...ansAgg.map((a) => a.key)])
  )
    .filter((k) => hrvMap.has(k) && ansMap.has(k))
    .sort();
  const recoveryLabelsFormatted = recoveryLabels.map((k) =>
    bucketLabel(k, dailyBucket)
  );
  const recoverySeries: MultiSeries[] =
    recoveryLabels.length > 0
      ? [
          {
            name: "HRV",
            color: CYAN,
            unit: "ms",
            values: recoveryLabels.map((k) => Math.round(hrvMap.get(k) ?? NaN)),
          },
          {
            name: "ANS",
            color: NEON,
            unit: "",
            values: recoveryLabels.map((k) =>
              Math.round((ansMap.get(k) ?? NaN) * 10) / 10
            ),
          },
        ]
      : [];

  // ── Weight ────────────────────────────────────────────────────────
  const weightAgg = aggregateSeries(
    weight,
    (r) => r.date,
    (r) => r.weight,
    dailyBucket,
    "avg"
  );
  const weightLine: LinePoint[] = weightAgg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value * 10) / 10,
    formatted: `${(Math.round(a.value * 10) / 10).toFixed(1)}`,
  }));

  // ── Blood Pressure ────────────────────────────────────────────────
  // Note: bp.date is "DD.MM.YYYY" text; use measuredAt (timestamp) for keys.
  const bpRows = bp.filter(
    (r) =>
      r.measuredAt != null && r.systolic != null && r.diastolic != null
  );
  const bpMap = new Map<
    string,
    { sys: number; dia: number; pulse: number; pulseN: number; n: number }
  >();
  for (const r of bpRows) {
    const isoDate = r.measuredAt!.toISOString().slice(0, 10);
    const key = bucketKey(isoDate, dailyBucket);
    const prev = bpMap.get(key) ?? {
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
    bpMap.set(key, prev);
  }
  const bpLabels = Array.from(bpMap.keys()).sort();
  const bpLabelsFormatted = bpLabels.map((k) => bucketLabel(k, dailyBucket));
  const bpSeries: MultiSeries[] =
    bpLabels.length > 0
      ? [
          {
            name: "Sys",
            color: RED,
            unit: "mmHg",
            values: bpLabels.map((k) => {
              const e = bpMap.get(k)!;
              return Math.round(e.sys / e.n);
            }),
          },
          {
            name: "Dia",
            color: NEON,
            unit: "mmHg",
            values: bpLabels.map((k) => {
              const e = bpMap.get(k)!;
              return Math.round(e.dia / e.n);
            }),
          },
          {
            name: "Puls",
            color: CYAN,
            unit: "bpm",
            values: bpLabels.map((k) => {
              const e = bpMap.get(k)!;
              return e.pulseN > 0 ? Math.round(e.pulse / e.pulseN) : 0;
            }),
          },
        ]
      : [];

  // ── Daily steps ───────────────────────────────────────────────────
  const stepsAgg = aggregateSeries(
    daily,
    (r) => r.date,
    (r) => r.steps,
    dailyBucket,
    dailyBucket === "daily" ? "sum" : "avg"
  );
  const stepsBars: BarPoint[] = stepsAgg.map((a) => ({
    label: bucketLabel(a.key, dailyBucket),
    value: Math.round(a.value),
    formatted: Math.round(a.value).toLocaleString("de-CH"),
  }));

  const rangeLbl = rangeLabel(range);
  const sportLbl = sport ? sportLabel(sport) : null;
  const activityTileLabel = sportLbl
    ? `Aktivitäten · ${rangeLbl} · ${sportLbl}`
    : `Aktivitäten · ${rangeLbl}`;

  return (
    <BentoPageShell>
      <BentoPageHeader section="Stats" title="Statistiken" />

      <div className="pb-1">
        <StatsFilterBar
          range={range}
          sport={sport}
          availableSports={availableSports}
          availableYears={availableYears}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 md:auto-rows-min md:[grid-auto-flow:row_dense]">
        {/* Aktivitäten KPIs */}
        <div
          className={
            !sport && sportSlices.length > 0
              ? "md:col-span-3"
              : "md:col-span-6"
          }
        >
          <BentoTile
            label={activityTileLabel}
            title="Totals"
            className="h-full flex flex-col"
          >
            <div className="grid flex-1 grid-cols-2 items-stretch gap-3 md:grid-cols-3">
              {kpis.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.label}
                    className="flex flex-col items-center justify-center rounded-lg border border-[#2a2a2a] bg-black/40 p-3 text-center"
                  >
                    <Icon
                      className="mb-1 h-4 w-4"
                      style={{
                        color: m.color,
                        filter: `drop-shadow(0 0 4px ${m.color}99)`,
                      }}
                    />
                    <div
                      className="flex justify-center leading-none"
                      style={{ fontSize: "1.6rem" }}
                    >
                      <LedValue value={m.value} color={m.color} />
                    </div>
                    <div
                      className={`${spaceMono.className} mt-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3]`}
                    >
                      {m.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </BentoTile>
        </div>

        {/* Sport donut */}
        {!sport && sportSlices.length > 0 && (
          <div className="md:col-span-3">
            <BentoTile
              label="Verteilung"
              title="Nach Sportart"
              className="h-full flex flex-col"
            >
              <div className="flex flex-1 w-full items-center">
                <DonutScope
                  slices={sportSlices}
                  centerLabel="Total"
                  centerValue={`${Math.round(totals.totalDistance / 1000)}`}
                  unit="km"
                  size={480}
                />
              </div>
            </BentoTile>
          </div>
        )}

        {/* Distance per bucket */}
        <div className="md:col-span-3">
          <BentoTile
            label={`Verlauf · ${bucket === "daily" ? "pro Tag" : bucket === "weekly" ? "pro Woche" : "pro Monat"}`}
            title="Distanz"
          >
            <BarsScope
              bars={distanceBars}
              color={NEON}
              unit="km"
              height={180}
              emptyLabel="Keine Aktivitäten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Duration per bucket */}
        <div className="md:col-span-3">
          <BentoTile
            label={`Verlauf · ${bucket === "daily" ? "pro Tag" : bucket === "weekly" ? "pro Woche" : "pro Monat"}`}
            title="Dauer"
          >
            <BarsScope
              bars={durationBars}
              color={CYAN}
              unit="min"
              height={180}
              emptyLabel="Keine Aktivitäten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Sleep score */}
        <div className="md:col-span-4">
          <BentoTile label="Schlaf" title="Score-Verlauf">
            <LineScope
              points={sleepLine}
              color={CYAN}
              unit="Score"
              height={200}
              minY={0}
              maxY={100}
              yTickStep={25}
              emptyLabel="Keine Schlafdaten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Sleep phases donut */}
        <div className="md:col-span-2">
          <BentoTile label="Schlaf" title="Phasen (Ø)">
            <DonutScope
              slices={phaseSlices}
              centerLabel="Ø Schlaf"
              centerValue={avgSleepCenter}
              unit="h:mm"
              size={320}
              emptyLabel="Keine Schlafdaten"
            />
          </BentoTile>
        </div>

        {/* Recovery */}
        <div className="md:col-span-6">
          <BentoTile label="Recovery" title="HRV & ANS Charge">
            <MultiLineScope
              labels={recoveryLabelsFormatted}
              series={recoverySeries}
              height={200}
              emptyLabel="Keine Nightly-Recharge-Daten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Weight */}
        <div className="md:col-span-6">
          <BentoTile label="Gewicht" title="Verlauf">
            <LineScope
              points={weightLine}
              color={GREEN}
              unit="kg"
              height={200}
              emptyLabel="Keine Gewichtsdaten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Blood pressure */}
        <div className="md:col-span-6">
          <BentoTile label="Blutdruck" title="Sys / Dia / Puls">
            <MultiLineScope
              labels={bpLabelsFormatted}
              series={bpSeries}
              height={200}
              emptyLabel="Keine Blutdruck-Daten im Zeitraum"
            />
          </BentoTile>
        </div>

        {/* Daily steps */}
        <div className="md:col-span-6">
          <BentoTile
            label="Tagesaktivität"
            title={
              dailyBucket === "daily"
                ? "Schritte pro Tag"
                : dailyBucket === "weekly"
                  ? "Schritte · Ø pro Woche"
                  : "Schritte · Ø pro Monat"
            }
          >
            <BarsScope
              bars={stepsBars}
              color={YELLOW}
              unit=""
              height={180}
              emptyLabel="Keine Tagesaktivität-Daten im Zeitraum"
            />
          </BentoTile>
        </div>
      </div>
    </BentoPageShell>
  );
}
