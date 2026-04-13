/**
 * TRIMP (Training Impulse) — Banister method, per-sample integration.
 *
 * Reference:
 *   Banister EW (1991). Modeling elite athletic performance.
 *   Physiological Testing of Elite Athletes, 403-424.
 *
 * Formula per interval [t_i, t_{i+1}]:
 *   dt    = (t_{i+1} - t_i) / 60        [minutes]
 *   HRR   = (bpm_i - HRrest) / (HRmax - HRrest)   clamped to [0, 1]
 *   k     = 1.92 (male) | 1.67 (female)
 *   c     = 0.64 (male) | 0.86 (female)
 *   trimp += dt * HRR * c * exp(k * HRR)
 */

export type Sex = "male" | "female" | null | undefined;

export interface HrSample {
  time: string | Date;
  bpm: number;
}

export interface TrimpUser {
  sex?: Sex;
  birthday?: Date | string | null;
  maxHeartRate?: number | null;
  restHeartRate?: number | null;
}

export interface TrimpActivity {
  maxHeartRate?: number | null;
  avgHeartRate?: number | null;
  duration?: number | null; // seconds
}

export function resolveHrMax(user: TrimpUser, activity: TrimpActivity): number {
  if (user.maxHeartRate && user.maxHeartRate > 0) return user.maxHeartRate;
  if (user.birthday) {
    const birth = new Date(user.birthday).getTime();
    if (!Number.isNaN(birth)) {
      const ageYears = (Date.now() - birth) / (365.25 * 24 * 3600 * 1000);
      if (ageYears > 5 && ageYears < 110) {
        // Tanaka et al. (2001)
        return Math.round(208 - 0.7 * ageYears);
      }
    }
  }
  if (activity.maxHeartRate && activity.maxHeartRate > 0) return activity.maxHeartRate;
  return 190;
}

export function resolveHrRest(user: TrimpUser): number {
  return user.restHeartRate && user.restHeartRate > 0 ? user.restHeartRate : 60;
}

function banisterCoefficients(sex: Sex): { c: number; k: number } {
  if (sex === "female") return { c: 0.86, k: 1.67 };
  return { c: 0.64, k: 1.92 };
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/**
 * Compute Banister TRIMP from HR time-series.
 * Returns null if no usable samples.
 */
export function computeBanisterTrimp(
  samples: HrSample[],
  hrMax: number,
  hrRest: number,
  sex: Sex
): number | null {
  if (!samples || samples.length < 2) return null;
  const denom = hrMax - hrRest;
  if (denom <= 0) return null;
  const { c, k } = banisterCoefficients(sex);

  let trimp = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const t0 = new Date(samples[i].time).getTime();
    const t1 = new Date(samples[i + 1].time).getTime();
    const dtMin = (t1 - t0) / 60000;
    if (!Number.isFinite(dtMin) || dtMin <= 0 || dtMin > 60) continue; // skip gaps > 60min
    const bpm = samples[i].bpm;
    if (!Number.isFinite(bpm) || bpm <= 0) continue;
    const hrr = clamp01((bpm - hrRest) / denom);
    trimp += dtMin * hrr * c * Math.exp(k * hrr);
  }
  return Math.round(trimp * 10) / 10;
}

/**
 * Fallback: Banister TRIMP from single avg HR + duration.
 */
export function computeBanisterTrimpAvg(
  avgHr: number,
  durationSec: number,
  hrMax: number,
  hrRest: number,
  sex: Sex
): number | null {
  const denom = hrMax - hrRest;
  if (denom <= 0 || !avgHr || !durationSec) return null;
  const { c, k } = banisterCoefficients(sex);
  const hrr = clamp01((avgHr - hrRest) / denom);
  const durMin = durationSec / 60;
  return Math.round(durMin * hrr * c * Math.exp(k * hrr) * 10) / 10;
}

export function computeTrimp(
  user: TrimpUser,
  activity: TrimpActivity,
  samples: HrSample[] | null | undefined
): number | null {
  const hrMax = resolveHrMax(user, activity);
  const hrRest = resolveHrRest(user);
  if (samples && samples.length >= 2) {
    const v = computeBanisterTrimp(samples, hrMax, hrRest, user.sex);
    if (v != null) return v;
  }
  if (activity.avgHeartRate && activity.duration) {
    return computeBanisterTrimpAvg(
      activity.avgHeartRate,
      activity.duration,
      hrMax,
      hrRest,
      user.sex
    );
  }
  return null;
}

export function interpretTrimp(trimp: number | null | undefined): string | null {
  if (trimp == null) return null;
  if (trimp < 100) return "Leicht";
  if (trimp < 200) return "Moderat";
  if (trimp < 400) return "Hoch";
  return "Sehr hoch";
}
