// Records-basierte Aggregate für Aktivitäten — Fallback wenn FIT-Session-Felder
// fehlen oder NULL sind. route_data: elevation in m, time ISO; speed_data: km/h.

export type RoutePoint = {
  lat: number;
  lng: number;
  time?: string;
  elevation?: number;
};
export type SpeedSample = { time: string; speed: number };

const SPEED_THRESHOLD_KMH = 0.5;
const SAMPLE_GAP_MAX_SEC = 10;
const ELEV_SMOOTH_WINDOW = 5;
const ELEV_MIN_DELTA_M = 1.0;

export function computeMovingTimeSec(samples: SpeedSample[]): number | null {
  if (samples.length < 2) return null;
  let movingSec = 0;
  for (let i = 1; i < samples.length; i++) {
    const cur = samples[i];
    const prev = samples[i - 1];
    if (cur.speed > SPEED_THRESHOLD_KMH) {
      const dt =
        (new Date(cur.time).getTime() - new Date(prev.time).getTime()) / 1000;
      if (dt > 0 && dt < SAMPLE_GAP_MAX_SEC) movingSec += dt;
    }
  }
  return movingSec > 0 ? Math.round(movingSec) : null;
}

export function computeSpeedStats(samples: SpeedSample[]): {
  avg: number | null;
  max: number | null;
} {
  if (samples.length === 0) return { avg: null, max: null };
  let sum = 0;
  let count = 0;
  let max = 0;
  for (const s of samples) {
    if (s.speed > 0) {
      sum += s.speed;
      count++;
    }
    if (s.speed > max) max = s.speed;
  }
  return {
    avg: count > 0 ? sum / count : null,
    max: max > 0 ? max : null,
  };
}

export function computeElevationStats(points: RoutePoint[]): {
  ascent: number | null;
  descent: number | null;
  minAlt: number | null;
  maxAlt: number | null;
} {
  // Finite-Number-Filter: NaN/Infinity rutschen sonst durch typeof-Check und
  // kontaminieren Math.min/max → NaN landet in der DB-real-Spalte und killt
  // alle Server-Component-Pfade die diese Aktivität anfassen.
  const elevs: number[] = [];
  for (const p of points) {
    if (typeof p.elevation === "number" && Number.isFinite(p.elevation)) {
      elevs.push(p.elevation);
    }
  }
  if (elevs.length === 0)
    return { ascent: null, descent: null, minAlt: null, maxAlt: null };

  // Moving-average smoothing reduziert Sensor-Rauschen vor Delta-Summierung.
  const half = Math.floor(ELEV_SMOOTH_WINDOW / 2);
  const smoothed: number[] = new Array(elevs.length);
  for (let i = 0; i < elevs.length; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(elevs.length - 1, i + half);
    let sum = 0;
    let n = 0;
    for (let j = lo; j <= hi; j++) {
      sum += elevs[j];
      n++;
    }
    smoothed[i] = sum / n;
  }

  let ascent = 0;
  let descent = 0;
  let lastSig = smoothed[0];
  for (let i = 1; i < smoothed.length; i++) {
    const diff = smoothed[i] - lastSig;
    if (Math.abs(diff) >= ELEV_MIN_DELTA_M) {
      if (diff > 0) ascent += diff;
      else descent += -diff;
      lastSig = smoothed[i];
    }
  }

  // Linearer min/max statt Spread — Spread sprengt bei sehr großen Arrays
  // (>~125k Elemente) und liefert dann NaN.
  let mn = elevs[0];
  let mx = elevs[0];
  for (let i = 1; i < elevs.length; i++) {
    if (elevs[i] < mn) mn = elevs[i];
    if (elevs[i] > mx) mx = elevs[i];
  }

  return {
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    minAlt: Math.round(mn),
    maxAlt: Math.round(mx),
  };
}
