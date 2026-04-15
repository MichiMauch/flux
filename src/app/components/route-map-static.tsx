// @ts-expect-error no types shipped
import polyline from "@mapbox/polyline";

interface Point {
  lat: number;
  lng: number;
}

export function RouteMapStatic({
  route,
  color,
  width = 600,
  height = 200,
}: {
  route: unknown;
  color: string; // hex with #
  width?: number;
  height?: number;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  if (!Array.isArray(route) || route.length < 2) return null;

  const points = (route as Point[]).filter(
    (p) => typeof p?.lat === "number" && typeof p?.lng === "number"
  );
  if (points.length < 2) return null;

  // Downsample to keep URL length reasonable
  const maxPoints = 150;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const sampled: [number, number][] = [];
  for (let i = 0; i < points.length; i += step)
    sampled.push([points[i].lat, points[i].lng]);
  const last = points[points.length - 1];
  const lastSampled = sampled[sampled.length - 1];
  if (!lastSampled || lastSampled[0] !== last.lat || lastSampled[1] !== last.lng) {
    sampled.push([last.lat, last.lng]);
  }

  const encoded = encodeURIComponent(polyline.encode(sampled));
  const hex = color.replace("#", "");
  const first = points[0];
  const end = points[points.length - 1];
  const markers = [
    `pin-s+ffffff(${first.lng.toFixed(5)},${first.lat.toFixed(5)})`,
    `pin-s+${hex}(${end.lng.toFixed(5)},${end.lat.toFixed(5)})`,
  ].join(",");
  const path = `path-4+${hex}-1(${encoded})`;

  const url =
    `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/` +
    `${path},${markers}/auto/${width}x${height}@2x?access_token=${token}&padding=20`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={width}
      height={height}
      className="w-full h-auto block"
      loading="lazy"
    />
  );
}
