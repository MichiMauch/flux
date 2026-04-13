import { resolveHrMax, type TrimpUser } from "./trimp";

export interface HrSample {
  time: string | Date;
  bpm: number;
}

export interface HrZone {
  index: 1 | 2 | 3 | 4 | 5;
  label: string;
  minBpm: number;
  maxBpm: number;
  seconds: number;
  percent: number;
  color: string;
}

export interface HrZonesResult {
  zones: HrZone[];
  totalSeconds: number;
  source: "thresholds" | "hrmax";
}

const COLORS = ["#FFD9CC", "#FFB199", "#FF8466", "#FF5B3A", "#C73A1E"];
const LABELS = ["Regeneration", "Aerob leicht", "Aerob", "Schwelle", "Anaerob"];

/**
 * Compute time-in-zone distribution from HR samples.
 *
 * Zone boundaries priority:
 *   1. Profile thresholds (aerobic + anaerobic + maxHeartRate)
 *      Z1: <aerobic
 *      Z2: aerobic → midway to anaerobic
 *      Z3: midway → anaerobic
 *      Z4: anaerobic → 95% HRmax
 *      Z5: >95% HRmax
 *   2. Else %HRmax (HRmax from user override / Tanaka / fallback 190)
 *      Z1 50–60 / Z2 60–70 / Z3 70–80 / Z4 80–90 / Z5 90–100
 */
export function computeHrZones(
  samples: HrSample[],
  user: TrimpUser & {
    aerobicThreshold?: number | null;
    anaerobicThreshold?: number | null;
  }
): HrZonesResult | null {
  if (!samples || samples.length < 2) return null;

  const aerobic = user.aerobicThreshold ?? null;
  const anaerobic = user.anaerobicThreshold ?? null;
  const hrMax = resolveHrMax(user, {});

  const useThresholds =
    aerobic != null && anaerobic != null && hrMax > 0 && anaerobic > aerobic;

  let bounds: number[];
  let source: "thresholds" | "hrmax";

  if (useThresholds) {
    const mid = Math.round((aerobic! + anaerobic!) / 2);
    const z5 = Math.round(hrMax * 0.95);
    bounds = [aerobic!, mid, anaerobic!, z5];
    source = "thresholds";
  } else {
    bounds = [
      Math.round(hrMax * 0.6),
      Math.round(hrMax * 0.7),
      Math.round(hrMax * 0.8),
      Math.round(hrMax * 0.9),
    ];
    source = "hrmax";
  }

  // Zone ranges for display
  const mins = [0, bounds[0], bounds[1], bounds[2], bounds[3]];
  const maxs = [bounds[0] - 1, bounds[1] - 1, bounds[2] - 1, bounds[3] - 1, hrMax];

  const seconds = [0, 0, 0, 0, 0];

  for (let i = 0; i < samples.length - 1; i++) {
    const t0 = new Date(samples[i].time).getTime();
    const t1 = new Date(samples[i + 1].time).getTime();
    const dt = (t1 - t0) / 1000;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 3600) continue;
    const bpm = samples[i].bpm;
    if (!Number.isFinite(bpm) || bpm <= 0) continue;

    let idx = 0;
    if (bpm >= bounds[3]) idx = 4;
    else if (bpm >= bounds[2]) idx = 3;
    else if (bpm >= bounds[1]) idx = 2;
    else if (bpm >= bounds[0]) idx = 1;
    else idx = 0;

    seconds[idx] += dt;
  }

  const totalSeconds = seconds.reduce((s, v) => s + v, 0);
  if (totalSeconds <= 0) return null;

  const zones: HrZone[] = seconds.map((s, i) => ({
    index: (i + 1) as HrZone["index"],
    label: LABELS[i],
    minBpm: mins[i],
    maxBpm: maxs[i],
    seconds: Math.round(s),
    percent: Math.round((s / totalSeconds) * 1000) / 10,
    color: COLORS[i],
  }));

  return { zones, totalSeconds: Math.round(totalSeconds), source };
}

export function formatZoneDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
