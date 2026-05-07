interface Point {
  lat: number;
  lng: number;
}

/**
 * Iterative Douglas-Peucker simplification on raw lat/lng using a local
 * equirectangular projection (lng scaled by cos(midLat)). Epsilon is in
 * the same local degree-space.
 */
function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points.slice();
  const midLat =
    points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    let maxD2 = 0;
    let idx = -1;
    const ax = points[lo].lng * lngScale;
    const ay = points[lo].lat;
    const bx = points[hi].lng * lngScale;
    const by = points[hi].lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy || 1e-18;
    for (let i = lo + 1; i < hi; i++) {
      const px = points[i].lng * lngScale;
      const py = points[i].lat;
      const t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      const tc = Math.max(0, Math.min(1, t));
      const qx = ax + tc * dx;
      const qy = ay + tc * dy;
      const ex = px - qx;
      const ey = py - qy;
      const d2 = ex * ex + ey * ey;
      if (d2 > maxD2) {
        maxD2 = d2;
        idx = i;
      }
    }
    if (idx !== -1 && maxD2 > epsilon * epsilon) {
      keep[idx] = 1;
      stack.push([lo, idx]);
      stack.push([idx, hi]);
    }
  }
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

const TARGET_POINTS = 120;
const MIN_POINTS = 60;

/**
 * Builds a small `{lat,lng}[]` polyline (target ~120 points) suitable for
 * list-card previews. Tolerates extra fields (time/elevation) on input.
 * Returns null when the route is too short to be meaningful.
 */
export function buildRouteGeometry(
  routeData: unknown,
): Point[] | null {
  if (!Array.isArray(routeData)) return null;
  const points: Point[] = [];
  for (const p of routeData) {
    const obj = p as { lat?: unknown; lng?: unknown };
    if (typeof obj?.lat === "number" && typeof obj?.lng === "number") {
      points.push({ lat: obj.lat, lng: obj.lng });
    }
  }
  if (points.length < 2) return null;
  if (points.length <= TARGET_POINTS) return points;

  // Iteratively widen epsilon until we hit the target band.
  let lo = 0;
  let hi = 0.01; // ~1km in lat-degrees, generous upper bound
  let result = points;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const simp = simplify(points, mid);
    if (simp.length > TARGET_POINTS) {
      lo = mid;
      result = simp;
    } else if (simp.length < MIN_POINTS) {
      hi = mid;
    } else {
      result = simp;
      break;
    }
  }
  return result;
}
