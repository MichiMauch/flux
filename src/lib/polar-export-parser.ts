/**
 * Parser helpers for Polar's GDPR/user-data-export JSON files.
 *
 * The export's schema differs from the AccessLink API — this module
 * maps both training-session-*.json and activity-YYYY-MM-DD.json files
 * into the shapes expected by the `activities` and `dailyActivity`
 * tables.
 */

import { polarSportIdToType } from "./polar-sport-map";

// ────────────────────────────────────────────────────────────────────────────
// Training sessions → activities row
// ────────────────────────────────────────────────────────────────────────────

type SampleEntry = {
  type: string;
  intervalMillis?: number;
  values?: number[];
};

type WayPoint = {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  elapsedMillis?: number;
};

export interface ParsedTraining {
  polarId: string;
  startTime: Date;
  stopTime: Date;
  durationSec: number;
  distanceMeters: number | null;
  calories: number | null;
  ascent: number | null;
  descent: number | null;
  hrAvg: number | null;
  hrMax: number | null;
  fatPercentage: number | null;
  carbPercentage: number | null;
  proteinPercentage: number | null;
  type: string;
  sportIdRaw: string | null;
  device: string | null;
  cardioLoad: number | null;
  cardioLoadInterpretation: string | null;
  routeData: { lat: number; lng: number; time: string; elevation?: number }[] | null;
  heartRateData: { time: string; bpm: number }[] | null;
  speedData: { time: string; speed: number }[] | null;
  minAltitude: number | null;
  maxAltitude: number | null;
}

export function parseTrainingSession(raw: unknown): ParsedTraining | null {
  const d = raw as Record<string, unknown>;
  const identifier = d.identifier as { id?: string } | undefined;
  const polarId = identifier?.id;
  if (!polarId) return null;

  const tzOffsetMin =
    typeof d.timezoneOffsetMinutes === "number"
      ? (d.timezoneOffsetMinutes as number)
      : 0;

  const startTime = parseLocalWithOffset(d.startTime as string, tzOffsetMin);
  const stopTime = parseLocalWithOffset(d.stopTime as string, tzOffsetMin);
  if (!startTime) return null;

  const durationMillis =
    typeof d.durationMillis === "number" ? (d.durationMillis as number) : 0;
  const durationSec = Math.round(durationMillis / 1000);

  const topSport = (d.sport as { id?: string } | undefined)?.id ?? null;

  const exercises = Array.isArray(d.exercises) ? (d.exercises as unknown[]) : [];
  const first = exercises[0] as Record<string, unknown> | undefined;

  // Fallbacks: prefer exercise-level data, then top-level
  const ex = first ?? d;

  const distanceMeters =
    typeof ex.distanceMeters === "number"
      ? (ex.distanceMeters as number)
      : typeof d.distanceMeters === "number"
        ? (d.distanceMeters as number)
        : null;
  const calories =
    typeof ex.calories === "number"
      ? Math.round(ex.calories as number)
      : typeof d.calories === "number"
        ? Math.round(d.calories as number)
        : null;
  const ascent =
    typeof ex.ascentMeters === "number" ? (ex.ascentMeters as number) : null;
  const descent =
    typeof ex.descentMeters === "number" ? (ex.descentMeters as number) : null;

  const hrAvg = typeof d.hrAvg === "number" ? Math.round(d.hrAvg as number) : null;
  const hrMax = typeof d.hrMax === "number" ? Math.round(d.hrMax as number) : null;

  const fatPercentage =
    typeof ex.fatPercentage === "number"
      ? Math.round(ex.fatPercentage as number)
      : null;
  const carbPercentage =
    typeof ex.carboPercentage === "number"
      ? Math.round(ex.carboPercentage as number)
      : null;
  const proteinPercentage =
    typeof ex.proteinPercentage === "number"
      ? Math.round(ex.proteinPercentage as number)
      : null;

  const exSport = (ex.sport as { id?: string } | undefined)?.id ?? null;
  const sportIdRaw = exSport ?? topSport;

  const device =
    (d.product as { modelName?: string } | undefined)?.modelName ?? null;

  const tlr = ex.trainingLoadReport as
    | { cardioLoad?: number; cardioLoadInterpretation?: string }
    | undefined;
  const cardioLoad =
    typeof tlr?.cardioLoad === "number" ? tlr.cardioLoad : null;
  const cardioLoadInterpretation = tlr?.cardioLoadInterpretation ?? null;

  // ── Route ────────────────────────────────────────────────────────────────
  const routesObj = ex.routes as { route?: { wayPoints?: WayPoint[] } } | undefined;
  const wayPoints = routesObj?.route?.wayPoints ?? [];
  const routeData: { lat: number; lng: number; time: string; elevation?: number }[] = [];
  for (const wp of wayPoints) {
    if (
      typeof wp.latitude === "number" &&
      typeof wp.longitude === "number" &&
      typeof wp.elapsedMillis === "number"
    ) {
      const t = new Date(startTime.getTime() + wp.elapsedMillis);
      routeData.push({
        lat: wp.latitude,
        lng: wp.longitude,
        time: t.toISOString(),
        elevation: typeof wp.altitude === "number" ? wp.altitude : undefined,
      });
    }
  }

  // ── Samples (HR / Speed / Altitude) ──────────────────────────────────────
  const samplesObj = ex.samples as { samples?: SampleEntry[] } | undefined;
  const samples = samplesObj?.samples ?? [];

  const heartRateData = buildTimeline(samples, "HEART_RATE", startTime).map(
    ({ time, value }) => ({ time, bpm: Math.round(value) })
  );
  const speedData = buildTimeline(samples, "SPEED", startTime).map(
    ({ time, value }) => ({ time, speed: value })
  );
  const altitudeValues = findSampleValues(samples, "ALTITUDE");
  const minAltitude =
    altitudeValues.length > 0 ? Math.round(Math.min(...altitudeValues)) : null;
  const maxAltitude =
    altitudeValues.length > 0 ? Math.round(Math.max(...altitudeValues)) : null;

  return {
    polarId,
    startTime,
    stopTime: stopTime ?? startTime,
    durationSec,
    distanceMeters,
    calories,
    ascent,
    descent,
    hrAvg,
    hrMax,
    fatPercentage,
    carbPercentage,
    proteinPercentage,
    type: polarSportIdToType(sportIdRaw),
    sportIdRaw,
    device,
    cardioLoad,
    cardioLoadInterpretation,
    routeData: routeData.length > 0 ? routeData : null,
    heartRateData: heartRateData.length > 0 ? heartRateData : null,
    speedData: speedData.length > 0 ? speedData : null,
    minAltitude,
    maxAltitude,
  };
}

function findSampleValues(samples: SampleEntry[], type: string): number[] {
  const s = samples.find((x) => x.type === type);
  return Array.isArray(s?.values) ? (s.values as number[]) : [];
}

function buildTimeline(
  samples: SampleEntry[],
  type: string,
  startTime: Date
): { time: string; value: number }[] {
  const s = samples.find((x) => x.type === type);
  if (!s || !Array.isArray(s.values) || s.values.length === 0) return [];
  const interval = typeof s.intervalMillis === "number" ? s.intervalMillis : 1000;
  const start = startTime.getTime();
  const out: { time: string; value: number }[] = [];
  for (let i = 0; i < s.values.length; i++) {
    const v = s.values[i];
    if (!Number.isFinite(v)) continue;
    out.push({
      time: new Date(start + i * interval).toISOString(),
      value: v,
    });
  }
  return out;
}

/**
 * Polar export puts local wall-clock time in startTime/stopTime and
 * the offset in timezoneOffsetMinutes. Reconstruct an absolute Date.
 */
function parseLocalWithOffset(
  local: string | undefined | null,
  tzOffsetMin: number
): Date | null {
  if (!local) return null;
  // If string already has offset/Z, just parse it.
  if (/Z|[+-]\d{2}:?\d{2}$/.test(local)) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Attach offset. "2026-01-03T12:14:29" + "+01:00"
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(tzOffsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  const iso = `${local}${sign}${hh}:${mm}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ────────────────────────────────────────────────────────────────────────────
// Daily activity → dailyActivity row
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedDaily {
  date: string; // YYYY-MM-DD
  steps: number | null;
  calories: number | null;
  distance: number | null;
  durationSec: number | null;
  activeTimeZones: { index: number; "inzone-duration": string }[];
  raw: unknown;
}

const LEVEL_TO_INDEX: Record<string, number> = {
  NON_WEAR: 0,
  SEDENTARY: 1,
  LIGHT: 2,
  CONTINUOS_MODERATE: 3,
  INTERMITTENT_MODERATE: 3,
  CONTINUOS_VIGOROUS: 4,
  INTERMITTENT_VIGOROUS: 4,
  // SLEEP, NO_DATA → skipped
};

const ACTIVE_LEVELS = new Set([
  "SEDENTARY",
  "LIGHT",
  "CONTINUOS_MODERATE",
  "INTERMITTENT_MODERATE",
  "CONTINUOS_VIGOROUS",
  "INTERMITTENT_VIGOROUS",
]);

export function parseDailyActivity(raw: unknown): ParsedDaily | null {
  const d = raw as Record<string, unknown>;
  const date = typeof d.date === "string" ? d.date : null;
  if (!date) return null;

  const summary = (d.summary as Record<string, unknown> | undefined) ?? {};
  const steps =
    typeof summary.stepCount === "number"
      ? Math.round(summary.stepCount as number)
      : null;
  const calories =
    typeof summary.calories === "number"
      ? Math.round(summary.calories as number)
      : null;
  const distance =
    typeof summary.stepsDistance === "number"
      ? (summary.stepsDistance as number)
      : null;

  const levels = Array.isArray(summary.activityLevels)
    ? (summary.activityLevels as { level?: string; duration?: string }[])
    : [];

  // Build active-time-zones in API-compatible shape and sum active duration.
  const zoneSeconds: Record<number, number> = {};
  let activeDurationSec = 0;
  for (const lvl of levels) {
    const key = lvl.level ?? "";
    const sec = parseIsoDuration(lvl.duration);
    if (sec <= 0) continue;
    const idx = LEVEL_TO_INDEX[key];
    if (idx != null) {
      zoneSeconds[idx] = (zoneSeconds[idx] ?? 0) + sec;
    }
    if (ACTIVE_LEVELS.has(key)) {
      activeDurationSec += sec;
    }
  }

  const activeTimeZones = Object.entries(zoneSeconds)
    .map(([idx, sec]) => ({
      index: Number(idx),
      "inzone-duration": `PT${sec}S`,
    }))
    .sort((a, b) => a.index - b.index);

  return {
    date,
    steps,
    calories,
    distance,
    durationSec: activeDurationSec > 0 ? activeDurationSec : null,
    activeTimeZones,
    raw,
  };
}

export function parseIsoDuration(s: string | undefined | null): number {
  if (!s) return 0;
  const m = s.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  return Math.round(
    parseFloat(m[1] || "0") * 3600 +
      parseFloat(m[2] || "0") * 60 +
      parseFloat(m[3] || "0")
  );
}
