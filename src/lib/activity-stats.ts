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
// Höhenrauschen (GPS/Barometer) liegt bei ±2–3 m. Eine Schwelle von 1 m lag
// darunter, also wurde Rauschen aufintegriert statt gefiltert: eine 18-km-Tour
// kam auf 13'115 m Aufstieg bei einem Höhenband von 1717 m. Gegen 40 Aktivitäten
// mit gerätegeliefertem total_ascent kalibriert — Fenster 11 / Schwelle 2 m
// liefert 1.3 % Median- und 3.9 % p90-Abweichung (vorher 5.0 % / 12.8 %).
const ELEV_SMOOTH_WINDOW = 11;
const ELEV_MIN_DELTA_M = 2.0;

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

/**
 * Pick between a device-reported climb figure and the one derived from the
 * track, rejecting the device value when it is not physically credible.
 *
 * Old Polar units (the V650 in particular) can report barometric ascent that is
 * off by a factor of five or more — one 18 km hike came in at 13'115 m against a
 * height band of 1717 m. The device value still wins in normal cases: a
 * barometer beats GPS altitude. It is only discarded when it exceeds the
 * track-derived figure by both a large factor and a large absolute amount, which
 * no measurement noise can explain.
 */
const ASCENT_IMPLAUSIBLE_RATIO = 2.5;
const ASCENT_IMPLAUSIBLE_ABS_M = 1000;

// Zweites, rein physikalisches Kriterium: Höhenmeter pro Kilometer. Ein V650
// meldete 2335 m auf 8.6 km Velofahrt — 273 Hm/km entsprechen 27 % mittlerer
// Steigung über die gesamte Strecke. Die steilsten Passfahrten der Welt liegen
// bei ~120 Hm/km (Zoncolan), Wandern kann kurzzeitig deutlich steiler werden.
const MAX_ASCENT_PER_KM_WHEELS = 150;
const MAX_ASCENT_PER_KM_FOOT = 400;

function maxAscentPerKm(type: string | null | undefined): number {
  if (!type) return MAX_ASCENT_PER_KM_FOOT;
  const t = type.toUpperCase();
  const onWheels =
    t.includes("CYCL") || t.includes("BIK") || t.includes("SKAT") || t.includes("ROAD");
  return onWheels ? MAX_ASCENT_PER_KM_WHEELS : MAX_ASCENT_PER_KM_FOOT;
}

export function reconcileAscent(
  deviceValue: number | null | undefined,
  routeValue: number | null | undefined,
  context?: { distanceMeters?: number | null; type?: string | null }
): number | null {
  if (deviceValue == null || !Number.isFinite(deviceValue)) return routeValue ?? null;
  if (routeValue == null || !Number.isFinite(routeValue) || routeValue <= 0)
    return deviceValue;
  // Verworfen wird nur ein zu HOHER Gerätewert. Ist die GPS-Höhe die grössere
  // der beiden, taugt sie nicht als Ersatz — sonst blaest die Terrain-Regel
  // einen plausiblen Wert auf (Kandersteg: Abstieg 1225 → 2742).
  if (routeValue >= deviceValue) return deviceValue;

  const beatsRouteImplausibly =
    deviceValue > routeValue * ASCENT_IMPLAUSIBLE_RATIO &&
    deviceValue - routeValue > ASCENT_IMPLAUSIBLE_ABS_M;

  const km = (context?.distanceMeters ?? 0) / 1000;
  const exceedsTerrainLimit =
    km >= 1 && deviceValue / km > maxAscentPerKm(context?.type);

  return beatsRouteImplausibly || exceedsTerrainLimit ? routeValue : deviceValue;
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
