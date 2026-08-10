import {
  buildTimePrefix,
  haversine,
  smoothElevation,
  type RoutePoint,
} from "./splits";

export type ClimbType = "up" | "down" | "flat";

export interface ClimbSegment {
  /** 1-based running number within the segment's own type. */
  index: number;
  type: ClimbType;
  startIdx: number;
  endIdx: number;
  distanceKm: number;
  durationSec: number;
  /** Signed net height change in metres (positive = uphill). */
  elevationChange: number;
  /** Signed average grade in percent. */
  gradePct: number;
  paceSecPerKm: number | null;
}

export interface ClimbTotals {
  count: number;
  distanceKm: number;
  durationSec: number;
  /** Absolute metres gained (up) or lost (down); 0 for flat. */
  elevation: number;
  paceSecPerKm: number | null;
}

export interface ClimbSummary {
  segments: ClimbSegment[];
  up: ClimbTotals;
  down: ClimbTotals;
  flat: ClimbTotals;
}

export interface ClimbOptions {
  /** Moving-average window over the raw elevation series (GPS noise ≈ ±2–3 m). */
  smoothWindow: number;
  /**
   * Counter-movement in metres that ends the current climb/descent. This is the
   * hysteresis: without it every bump inside a long ascent starts a new segment
   * and the segment count explodes.
   */
  reversalM: number;
  /** Segments below this net height change are demoted to "flat". */
  minGainM: number;
  /** Segments flatter than this average grade are demoted to "flat". */
  minGradePct: number;
  /** Segments shorter than this are demoted to "flat". */
  minDistanceKm: number;
}

export const DEFAULT_CLIMB_OPTIONS: ClimbOptions = {
  smoothWindow: 15,
  reversalM: 10,
  minGainM: 10,
  minGradePct: 2,
  minDistanceKm: 0.1,
};

interface RawSegment {
  startIdx: number;
  endIdx: number;
}

/**
 * Split the route into alternating climb/descent stretches using a hysteresis
 * walk over the smoothed elevation series, then demote the insignificant ones
 * to "flat" and aggregate per type.
 *
 * Per-segment height change is scaled so the sum matches the device-reported
 * ascent/descent totals — same approach as computeSplits(), so the numbers here
 * stay consistent with the kilometre list.
 */
export function computeClimbs(
  routeData: RoutePoint[],
  totalDistanceMeters?: number | null,
  totalAscent?: number | null,
  totalDescent?: number | null,
  options?: Partial<ClimbOptions>
): ClimbSummary | null {
  const opts = { ...DEFAULT_CLIMB_OPTIONS, ...options };
  if (routeData.length < 2) return null;

  const smoothed = smoothElevation(routeData, opts.smoothWindow);
  if (!smoothed.some((e) => e != null)) return null;

  // Distance per segment, scaled so the total matches the device value.
  let haversineTotal = 0;
  const rawSegDist: number[] = new Array(routeData.length).fill(0);
  for (let i = 1; i < routeData.length; i++) {
    const d = haversine(routeData[i - 1], routeData[i]);
    rawSegDist[i] = d;
    haversineTotal += d;
  }
  const scale =
    totalDistanceMeters && haversineTotal > 0
      ? totalDistanceMeters / haversineTotal
      : 1;

  // Per-segment ascent/descent, scaled onto the device totals.
  const segAscent: number[] = new Array(routeData.length).fill(0);
  const segDescent: number[] = new Array(routeData.length).fill(0);
  let rawAscentSum = 0;
  let rawDescentSum = 0;
  for (let i = 1; i < routeData.length; i++) {
    const a = smoothed[i - 1];
    const b = smoothed[i];
    if (a == null || b == null) continue;
    const d = b - a;
    if (d > 0) {
      segAscent[i] = d;
      rawAscentSum += d;
    } else if (d < 0) {
      segDescent[i] = -d;
      rawDescentSum += -d;
    }
  }
  if (totalAscent != null && totalAscent > 0 && rawAscentSum > 0) {
    const k = totalAscent / rawAscentSum;
    for (let i = 0; i < segAscent.length; i++) segAscent[i] *= k;
  }
  if (totalDescent != null && totalDescent > 0 && rawDescentSum > 0) {
    const k = totalDescent / rawDescentSum;
    for (let i = 0; i < segDescent.length; i++) segDescent[i] *= k;
  }

  const raw = segmentByHysteresis(smoothed, opts.reversalM);
  if (raw.length === 0) return null;

  // Materialise metrics, classify, then merge neighbours that ended up with
  // the same type (an "up" and a "down" both demoted to flat become one).
  const merged: ClimbSegment[] = [];
  for (const seg of raw) {
    let distanceM = 0;
    let ascent = 0;
    let descent = 0;
    for (let i = seg.startIdx + 1; i <= seg.endIdx; i++) {
      distanceM += rawSegDist[i] * scale;
      ascent += segAscent[i];
      descent += segDescent[i];
    }
    const elevationChange = ascent - descent;
    const type = classify(distanceM, elevationChange, opts);

    const prev = merged[merged.length - 1];
    if (prev && prev.type === type) {
      prev.endIdx = seg.endIdx;
      prev.distanceKm += distanceM / 1000;
      prev.elevationChange += elevationChange;
      continue;
    }
    merged.push({
      index: 0,
      type,
      startIdx: seg.startIdx,
      endIdx: seg.endIdx,
      distanceKm: distanceM / 1000,
      durationSec: 0,
      elevationChange,
      gradePct: 0,
      paceSecPerKm: null,
    });
  }

  const timePrefix = buildTimePrefix(routeData);
  const counters: Record<ClimbType, number> = { up: 0, down: 0, flat: 0 };
  for (const seg of merged) {
    seg.index = ++counters[seg.type];
    seg.durationSec = Math.max(
      0,
      timePrefix[seg.endIdx] - timePrefix[seg.startIdx]
    );
    const distanceM = seg.distanceKm * 1000;
    seg.gradePct = distanceM > 0 ? (seg.elevationChange / distanceM) * 100 : 0;
    seg.paceSecPerKm =
      seg.distanceKm > 0 && seg.durationSec > 0
        ? seg.durationSec / seg.distanceKm
        : null;
  }

  return {
    segments: merged,
    up: totalsFor(merged, "up"),
    down: totalsFor(merged, "down"),
    flat: totalsFor(merged, "flat"),
  };
}

/**
 * Walk the elevation series and cut a new segment whenever the series reverses
 * by more than `reversalM` off its running extreme. Segments are cut at that
 * extreme, not at the point where the reversal was detected, so a summit lands
 * exactly on the boundary between climb and descent.
 */
function segmentByHysteresis(
  smoothed: (number | null)[],
  reversalM: number
): RawSegment[] {
  const segments: RawSegment[] = [];
  let startIdx = -1;
  let startEl = 0;
  let extremeIdx = -1;
  let extremeEl = 0;
  let dir: 1 | -1 | 0 = 0;

  for (let i = 0; i < smoothed.length; i++) {
    const el = smoothed[i];
    if (el == null) continue;
    if (startIdx < 0) {
      startIdx = i;
      startEl = el;
      extremeIdx = i;
      extremeEl = el;
      continue;
    }

    if (dir === 0) {
      // Direction still undecided: track both ends, commit once the series has
      // moved far enough away from the start in either direction.
      if (el - startEl >= reversalM) {
        dir = 1;
        extremeIdx = i;
        extremeEl = el;
      } else if (startEl - el >= reversalM) {
        dir = -1;
        extremeIdx = i;
        extremeEl = el;
      } else if (
        (el > extremeEl && el - startEl > 0) ||
        (el < extremeEl && el - startEl < 0)
      ) {
        extremeIdx = i;
        extremeEl = el;
      }
      continue;
    }

    if (dir === 1) {
      if (el >= extremeEl) {
        extremeIdx = i;
        extremeEl = el;
      } else if (extremeEl - el >= reversalM) {
        segments.push({ startIdx, endIdx: extremeIdx });
        startIdx = extremeIdx;
        startEl = extremeEl;
        dir = -1;
        extremeIdx = i;
        extremeEl = el;
      }
    } else {
      if (el <= extremeEl) {
        extremeIdx = i;
        extremeEl = el;
      } else if (el - extremeEl >= reversalM) {
        segments.push({ startIdx, endIdx: extremeIdx });
        startIdx = extremeIdx;
        startEl = extremeEl;
        dir = 1;
        extremeIdx = i;
        extremeEl = el;
      }
    }
  }

  // Close the trailing segment at the last point with elevation, not at the
  // running extreme — the remainder after the extreme belongs to it too.
  if (startIdx >= 0) {
    let lastIdx = -1;
    for (let i = smoothed.length - 1; i >= 0; i--) {
      if (smoothed[i] != null) {
        lastIdx = i;
        break;
      }
    }
    if (lastIdx > startIdx) {
      segments.push({ startIdx, endIdx: lastIdx });
    }
  }

  return segments;
}

function classify(
  distanceM: number,
  elevationChange: number,
  opts: ClimbOptions
): ClimbType {
  if (distanceM < opts.minDistanceKm * 1000) return "flat";
  if (Math.abs(elevationChange) < opts.minGainM) return "flat";
  const grade = (Math.abs(elevationChange) / distanceM) * 100;
  if (grade < opts.minGradePct) return "flat";
  return elevationChange > 0 ? "up" : "down";
}

function totalsFor(segments: ClimbSegment[], type: ClimbType): ClimbTotals {
  let count = 0;
  let distanceKm = 0;
  let durationSec = 0;
  let elevation = 0;
  for (const s of segments) {
    if (s.type !== type) continue;
    count += 1;
    distanceKm += s.distanceKm;
    durationSec += s.durationSec;
    elevation += Math.abs(s.elevationChange);
  }
  return {
    count,
    distanceKm,
    durationSec,
    elevation: type === "flat" ? 0 : Math.round(elevation),
    paceSecPerKm:
      distanceKm > 0 && durationSec > 0 ? durationSec / distanceKm : null,
  };
}

/** Segment type at a given route index — used to colour the elevation chart. */
export function segmentTypeAt(
  segments: ClimbSegment[],
  routeIdx: number
): ClimbType | null {
  for (const s of segments) {
    if (routeIdx >= s.startIdx && routeIdx <= s.endIdx) return s.type;
  }
  return null;
}
