import type { RoutePoint } from "@/lib/splits";

export interface FlightTrack {
  points: RoutePoint[];
  distanceFromStart: Float32Array;
  totalDistance: number;
  bbox: [number, number, number, number];
  minEle: number;
  maxEle: number;
  durationSec: number | null;
}

export interface FlightSample {
  lng: number;
  lat: number;
  elevation: number;
  bearingDeg: number;
  distanceM: number;
  slope: number;
  idx: number;
}

function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function buildFlightTrack(route: RoutePoint[]): FlightTrack | null {
  if (route.length < 2) return null;
  const n = route.length;
  const dfs = new Float32Array(n);
  let west = route[0].lng;
  let east = route[0].lng;
  let south = route[0].lat;
  let north = route[0].lat;
  let minEle = Number.POSITIVE_INFINITY;
  let maxEle = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    const p = route[i];
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.elevation != null) {
      if (p.elevation < minEle) minEle = p.elevation;
      if (p.elevation > maxEle) maxEle = p.elevation;
    }
    if (i > 0) {
      const prev = route[i - 1];
      dfs[i] = dfs[i - 1] + haversine(prev.lat, prev.lng, p.lat, p.lng);
    }
  }
  if (!Number.isFinite(minEle)) minEle = 0;
  if (!Number.isFinite(maxEle)) maxEle = 0;

  let durationSec: number | null = null;
  const firstTime = route[0].time;
  const lastTime = route[n - 1].time;
  if (firstTime && lastTime) {
    const ms = new Date(lastTime).getTime() - new Date(firstTime).getTime();
    if (Number.isFinite(ms) && ms > 0) durationSec = ms / 1000;
  }

  return {
    points: route,
    distanceFromStart: dfs,
    totalDistance: dfs[n - 1],
    bbox: [west, south, east, north],
    minEle,
    maxEle,
    durationSec,
  };
}

function findSegment(
  dfs: Float32Array,
  target: number,
): { i: number; t: number } {
  const n = dfs.length;
  if (target <= dfs[0]) return { i: 1, t: 0 };
  if (target >= dfs[n - 1]) return { i: n - 1, t: 1 };
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dfs[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const segLen = dfs[i] - dfs[i - 1];
  const t = segLen > 0 ? (target - dfs[i - 1]) / segLen : 0;
  return { i, t };
}

export function sampleAlongTrack(
  track: FlightTrack,
  progress: number,
  lookAheadM = 60,
  lookBackM = 20,
): FlightSample {
  const clamped = Math.max(0, Math.min(1, progress));
  const dfs = track.distanceFromStart;
  const target = clamped * track.totalDistance;
  const { i, t } = findSegment(dfs, target);
  const a = track.points[i - 1];
  const b = track.points[i];

  const lng = a.lng + (b.lng - a.lng) * t;
  const lat = a.lat + (b.lat - a.lat) * t;
  const aEle = a.elevation ?? 0;
  const bEle = b.elevation ?? aEle;
  const elevation = aEle + (bEle - aEle) * t;

  const backTarget = Math.max(0, target - lookBackM);
  const { i: ib, t: tb } = findSegment(dfs, backTarget);
  const ba = track.points[ib - 1];
  const bb = track.points[ib];
  const lngBack = ba.lng + (bb.lng - ba.lng) * tb;
  const latBack = ba.lat + (bb.lat - ba.lat) * tb;

  const aheadTarget = Math.min(track.totalDistance, target + lookAheadM);
  const { i: ia, t: ta } = findSegment(dfs, aheadTarget);
  const aa = track.points[ia - 1];
  const ab = track.points[ia];
  const lngAhead = aa.lng + (ab.lng - aa.lng) * ta;
  const latAhead = aa.lat + (ab.lat - aa.lat) * ta;

  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLon = (lngAhead - lngBack) * cosLat;
  const dLat = latAhead - latBack;
  let bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  if (bearing < 0) bearing += 360;

  const aheadEle = (aa.elevation ?? aEle) + ((ab.elevation ?? aa.elevation ?? aEle) - (aa.elevation ?? aEle)) * ta;
  const backEle = (ba.elevation ?? aEle) + ((bb.elevation ?? ba.elevation ?? aEle) - (ba.elevation ?? aEle)) * tb;
  const distSpan = Math.max(1, aheadTarget - backTarget);
  const slope = ((aheadEle - backEle) / distSpan) * 100;

  return {
    lng,
    lat,
    elevation,
    bearingDeg: bearing,
    distanceM: target,
    slope,
    idx: i - 1,
  };
}

export function formatPlaybackTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}
