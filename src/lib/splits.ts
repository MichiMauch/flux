export interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  time?: string;
}

export interface HrSample {
  time: string;
  bpm: number;
}

export interface Split {
  index: number;
  startIdx: number;
  endIdx: number;
  durationSec: number;
  cumDurationSec: number;
  distanceKm: number;
  cumDistanceKm: number;
  hrAvg: number | null;
  hrMax: number | null;
  paceSecPerKm: number | null;
  paceBestSecPerKm: number | null;
  ascent: number;
  descent: number;
}

function smoothElevation(data: RoutePoint[], window: number): (number | null)[] {
  const n = data.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const half = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      const e = data[j].elevation;
      if (e != null) {
        sum += e;
        count += 1;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function computeSplits(
  routeData: RoutePoint[],
  heartRateData: HrSample[],
  totalDistanceMeters?: number | null,
  totalAscent?: number | null,
  totalDescent?: number | null
): Split[] {
  if (routeData.length < 2) return [];
  const hrTimes = heartRateData.map((h) => new Date(h.time).getTime());
  const hrBpms = heartRateData.map((h) => h.bpm);

  let haversineTotal = 0;
  for (let i = 1; i < routeData.length; i++) {
    haversineTotal += haversine(routeData[i - 1], routeData[i]);
  }
  const scale =
    totalDistanceMeters && haversineTotal > 0
      ? totalDistanceMeters / haversineTotal
      : 1;

  // Smooth elevation with moving average to filter GPS noise (~±2–3 m)
  const smoothed = smoothElevation(routeData, 15);
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
  // Scale per-segment values so that totals match the device-reported numbers.
  // Polar/FIT applies its own (better) elevation smoothing — we trust its totals
  // and just distribute them proportionally to where our smoothed series said
  // the changes happened.
  if (totalAscent != null && totalAscent > 0 && rawAscentSum > 0) {
    const k = totalAscent / rawAscentSum;
    for (let i = 0; i < segAscent.length; i++) segAscent[i] *= k;
  }
  if (totalDescent != null && totalDescent > 0 && rawDescentSum > 0) {
    const k = totalDescent / rawDescentSum;
    for (let i = 0; i < segDescent.length; i++) segDescent[i] *= k;
  }

  const splits: Split[] = [];
  let splitStart = 0;
  let splitStartDist = 0;
  let cumDist = 0;
  let cumDurationSec = 0;

  for (let i = 1; i < routeData.length; i++) {
    const prev = routeData[i - 1];
    const curr = routeData[i];
    const segDist = haversine(prev, curr) * scale;
    cumDist += segDist;

    const nextKmMark = (splits.length + 1) * 1000;
    if (cumDist >= nextKmMark || i === routeData.length - 1) {
      const startTime = routeData[splitStart].time
        ? new Date(routeData[splitStart].time!).getTime()
        : 0;
      const endTime = curr.time ? new Date(curr.time).getTime() : 0;
      const durationSec = Math.max(0, (endTime - startTime) / 1000);
      cumDurationSec += durationSec;
      const distanceM = cumDist - splitStartDist;
      const distanceKm = distanceM / 1000;
      const paceSecPerKm = distanceKm > 0 ? durationSec / distanceKm : null;

      let hrSum = 0;
      let hrN = 0;
      let hrMax = 0;
      let ascent = 0;
      let descent = 0;
      let bestPace: number | null = null;
      for (let j = splitStart + 1; j <= i; j++) {
        const pp = routeData[j - 1];
        const pc = routeData[j];
        ascent += segAscent[j];
        descent += segDescent[j];
        if (pp.time && pc.time) {
          const dt = (new Date(pc.time).getTime() - new Date(pp.time).getTime()) / 1000;
          const dd = haversine(pp, pc) * scale;
          if (dt > 0 && dd > 0) {
            const pace = dt / (dd / 1000);
            if (pace > 60 && pace < 1800) {
              if (bestPace == null || pace < bestPace) bestPace = pace;
            }
          }
        }
        if (pc.time && hrTimes.length > 0) {
          const tms = new Date(pc.time).getTime();
          let lo = 0;
          let hi = hrTimes.length - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (hrTimes[mid] < tms) lo = mid + 1;
            else hi = mid;
          }
          const bpm = hrBpms[lo];
          if (bpm > 0) {
            hrSum += bpm;
            hrN += 1;
            if (bpm > hrMax) hrMax = bpm;
          }
        }
      }

      splits.push({
        index: splits.length + 1,
        startIdx: splitStart,
        endIdx: i,
        durationSec,
        cumDurationSec,
        distanceKm,
        cumDistanceKm: cumDist / 1000,
        hrAvg: hrN > 0 ? Math.round(hrSum / hrN) : null,
        hrMax: hrMax > 0 ? hrMax : null,
        paceSecPerKm,
        paceBestSecPerKm: bestPace,
        ascent: Math.round(ascent),
        descent: Math.round(descent),
      });

      splitStart = i;
      splitStartDist = cumDist;
    }
  }

  return splits;
}
