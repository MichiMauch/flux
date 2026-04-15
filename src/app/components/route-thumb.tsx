interface Point {
  lat: number;
  lng: number;
}

export function RouteThumb({
  route,
  width = 96,
  height = 56,
  color = "currentColor",
  strokeWidth = 1.5,
  className = "rounded-sm bg-surface/60",
}: {
  route: unknown;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  if (!Array.isArray(route) || route.length < 2) return null;
  const points = (route as Point[]).filter(
    (p) => typeof p?.lat === "number" && typeof p?.lng === "number"
  );
  if (points.length < 2) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const pad = 2;
  const dLat = Math.max(1e-6, maxLat - minLat);
  const dLng = Math.max(1e-6, maxLng - minLng);
  // Keep aspect ratio: scale both axes by same factor to fill box
  const sx = (width - pad * 2) / dLng;
  const sy = (height - pad * 2) / dLat;
  const s = Math.min(sx, sy);
  const offX = (width - dLng * s) / 2;
  const offY = (height - dLat * s) / 2;

  // Downsample to ~60 points for compact SVG
  const maxPoints = 60;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const sampled: Point[] = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }

  const d = sampled
    .map((p, i) => {
      const x = offX + (p.lng - minLng) * s;
      const y = offY + (maxLat - p.lat) * s;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RouteThumbFull({
  route,
  color,
  height = 140,
}: {
  route: unknown;
  color: string;
  height?: number;
}) {
  if (!Array.isArray(route) || route.length < 2) return null;
  const points = (route as { lat: number; lng: number }[]).filter(
    (p) => typeof p?.lat === "number" && typeof p?.lng === "number"
  );
  if (points.length < 2) return null;

  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const pad = 8;
  const dLat = Math.max(1e-6, maxLat - minLat);
  const dLng = Math.max(1e-6, maxLng - minLng);
  // Target viewBox: 600 wide
  const W = 600;
  const H = height * (W / 600);
  const sx = (W - pad * 2) / dLng;
  const sy = (H - pad * 2) / dLat;
  const s = Math.min(sx, sy);
  const offX = (W - dLng * s) / 2;
  const offY = (H - dLat * s) / 2;

  const maxPoints = 200;
  const step = Math.max(1, Math.floor(points.length / maxPoints));
  const sampled: { lat: number; lng: number }[] = [];
  for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }

  const d = sampled
    .map((p, i) => {
      const x = offX + (p.lng - minLng) * s;
      const y = offY + (maxLat - p.lat) * s;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  const fx = offX + (first.lng - minLng) * s;
  const fy = offY + (maxLat - first.lat) * s;
  const lx = offX + (last.lng - minLng) * s;
  const ly = offY + (maxLat - last.lat) * s;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-auto block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`route-bg-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#route-bg-${color})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={fx} cy={fy} r={5} fill="white" stroke={color} strokeWidth={2} />
      <circle cx={lx} cy={ly} r={5} fill={color} stroke="white" strokeWidth={2} />
    </svg>
  );
}
