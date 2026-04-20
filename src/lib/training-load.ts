/**
 * Training Load — CTL / ATL / TSB (Fitness / Fatigue / Form).
 *
 * Based on the Banister impulse-response model popularised by TrainingPeaks.
 * Given a daily TRIMP score, each metric is an exponentially weighted moving
 * average with a specific time constant:
 *
 *   CTL_d = CTL_(d-1) + (TRIMP_d − CTL_(d-1)) * (1 − exp(−1 / τ_CTL))
 *   ATL_d = ATL_(d-1) + (TRIMP_d − ATL_(d-1)) * (1 − exp(−1 / τ_ATL))
 *   TSB_d = CTL_d − ATL_d
 *
 * Days without any activity count as TRIMP = 0 (recovery days reduce load).
 * Multiple activities on the same day are summed upstream in the data layer.
 */

export const CTL_TAU_DAYS = 42;
export const ATL_TAU_DAYS = 7;

export const CTL_ALPHA = 1 - Math.exp(-1 / CTL_TAU_DAYS);
export const ATL_ALPHA = 1 - Math.exp(-1 / ATL_TAU_DAYS);

export interface TrainingLoadPoint {
  date: string; // YYYY-MM-DD (local)
  trimp: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export type FormZone =
  | "transition"
  | "fresh"
  | "neutral"
  | "optimal"
  | "high-risk";

export interface FormZoneDef {
  id: FormZone;
  label: string;
  min: number;
  max: number;
  color: string;
  description: string;
}

// TrainingPeaks-style Performance Manager Chart zones.
export const FORM_ZONES: FormZoneDef[] = [
  {
    id: "high-risk",
    label: "Überlastung",
    min: -Infinity,
    max: -30,
    color: "#EF4444",
    description: "Hohe Ermüdung, Verletzungsrisiko",
  },
  {
    id: "optimal",
    label: "Optimal Training",
    min: -30,
    max: -10,
    color: "#FF6A00",
    description: "Produktiver Trainingsbereich",
  },
  {
    id: "neutral",
    label: "Neutral",
    min: -10,
    max: 5,
    color: "#737373",
    description: "Ausgeglichen",
  },
  {
    id: "fresh",
    label: "Frisch",
    min: 5,
    max: 25,
    color: "#22C55E",
    description: "Race-ready",
  },
  {
    id: "transition",
    label: "Detraining",
    min: 25,
    max: Infinity,
    color: "#EAB308",
    description: "Zu frisch, Fitness verloren",
  },
];

export function getFormZone(tsb: number): FormZoneDef {
  return FORM_ZONES.find((z) => tsb >= z.min && tsb < z.max) ?? FORM_ZONES[2];
}

/**
 * Readability-first score derived from TSB.
 * 0 = ausgelaugt, 50 = neutral, 100 = voll erholt.
 * TSB  -30 (Überlastungsgrenze) → 5
 * TSB  -10 (neutral-grenze)     → 35
 * TSB    0 (ausgeglichen)       → 50
 * TSB  +25 (race-ready)         → 88
 */
export function computeReadiness(tsb: number): number {
  return Math.max(0, Math.min(100, Math.round(50 + tsb * 1.5)));
}

export interface ReadinessInterpretation {
  headline: string; // one word
  hint: string; // short actionable hint
  color: string;
  zoneId: FormZone;
}

const ZONE_HINTS: Record<FormZone, { headline: string; hint: string }> = {
  "high-risk": {
    headline: "Ausgelaugt",
    hint: "Heute Pause oder ganz locker. Regeneration geht vor.",
  },
  optimal: {
    headline: "Belastet",
    hint: "Du baust Fitness auf. Leichte Einheiten sind ok.",
  },
  neutral: {
    headline: "Ausgeglichen",
    hint: "Bereit für eine normale Trainingseinheit.",
  },
  fresh: {
    headline: "Frisch",
    hint: "Gute Energie — harte Einheiten oder Wettkampf möglich.",
  },
  transition: {
    headline: "Sehr frisch",
    hint: "Top-Zustand. Aufpassen: zu lange frisch = Fitness verlieren.",
  },
};

/**
 * Derive headline/hint/color from the TSB form-zone so that the label is
 * always consistent with the zone (the readiness number is only a visual aid).
 */
export function interpretReadiness(tsb: number): ReadinessInterpretation {
  const zone = getFormZone(tsb);
  const h = ZONE_HINTS[zone.id];
  return { headline: h.headline, hint: h.hint, color: zone.color, zoneId: zone.id };
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Compute a daily CTL/ATL/TSB time series.
 *
 * @param dailyTrimp  Map of YYYY-MM-DD → summed TRIMP for that day
 * @param from        Inclusive start of the output window (local midnight)
 * @param to          Inclusive end of the output window (local midnight)
 * @param seed        Optional starting CTL/ATL (carry-over from earlier runs)
 */
export function computeTrainingLoadSeries(
  dailyTrimp: Map<string, number>,
  from: Date,
  to: Date,
  seed: { ctl?: number; atl?: number } = {}
): TrainingLoadPoint[] {
  const out: TrainingLoadPoint[] = [];
  let ctl = seed.ctl ?? 0;
  let atl = seed.atl ?? 0;

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const key = toDateKey(d);
    const trimp = dailyTrimp.get(key) ?? 0;
    ctl = ctl + (trimp - ctl) * CTL_ALPHA;
    atl = atl + (trimp - atl) * ATL_ALPHA;
    out.push({
      date: key,
      trimp: round1(trimp),
      ctl: round1(ctl),
      atl: round1(atl),
      tsb: round1(ctl - atl),
    });
  }
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
