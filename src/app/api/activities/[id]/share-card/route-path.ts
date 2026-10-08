export type RoutePoint = {
  lat: number;
  lng: number;
};

export function sampleRoute(points: RoutePoint[] | null, max = 120): RoutePoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length <= max) return points;
  const out: RoutePoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const idx = Math.round((i * (points.length - 1)) / (max - 1));
    const p = points[idx];
    if (p) out.push(p);
  }
  return out;
}

// Project route to an SVG path that fits a width×height box while preserving
// the geographic aspect ratio (so the route isn't stretched).
export function routeToPath(
  pointsIn: RoutePoint[] | null,
  width: number,
  height: number,
  pad = 120,
  maxPoints = 96
) {
  const points = sampleRoute(pointsIn, maxPoints);
  if (points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = maxLat - minLat || 0.001;
  // longitude degrees shrink with latitude — correct for it so the shape
  // matches what a map would show.
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180) || 1;
  const lngRange = (maxLng - minLng) * lngScale || 0.001;

  const boxW = width - pad * 2;
  const boxH = height - pad * 2;
  const scale = Math.min(boxW / lngRange, boxH / latRange);
  const drawW = lngRange * scale;
  const drawH = latRange * scale;
  const offX = pad + (boxW - drawW) / 2;
  const offY = pad + (boxH - drawH) / 2;

  return points
    .map((p, idx) => {
      const x = offX + ((p.lng - minLng) * lngScale) * scale;
      const y = offY + drawH - (p.lat - minLat) * scale;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
