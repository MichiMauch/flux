// Plausible physiological ranges (mmHg / bpm). Outside-of-range values are
// almost certainly junk and shouldn't enter the dataset.
const SYS_MIN = 50;
const SYS_MAX = 260;
const DIA_MIN = 30;
const DIA_MAX = 200;
const PULSE_MIN = 20;
const PULSE_MAX = 250;

export interface BpReading {
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function toReading(
  systolic: unknown,
  diastolic: unknown,
  pulse: unknown
): BpReading | null {
  if (!inRange(systolic, SYS_MIN, SYS_MAX)) return null;
  if (!inRange(diastolic, DIA_MIN, DIA_MAX)) return null;
  return {
    systolic,
    diastolic,
    pulse: inRange(pulse, PULSE_MIN, PULSE_MAX) ? pulse : null,
  };
}

/**
 * A tracker session holds two measurements. Flux keeps only the one with the
 * lower systolic value (tie: lower diastolic) — same rule as the tracker's
 * getBetterMeasurement. Sessions without usable single measurements (older
 * tracker versions only sent the averages) fall back to the average.
 */
export function pickBpReading(s: Record<string, unknown>): BpReading | null {
  const m1 = toReading(s.systolic1, s.diastolic1, s.pulse1);
  const m2 = toReading(s.systolic2, s.diastolic2, s.pulse2);
  if (m1 && m2) {
    const m1Wins =
      m1.systolic < m2.systolic ||
      (m1.systolic === m2.systolic && m1.diastolic <= m2.diastolic);
    return m1Wins ? m1 : m2;
  }
  return m1 ?? m2 ?? toReading(s.systolicAvg, s.diastolicAvg, s.pulseAvg);
}
