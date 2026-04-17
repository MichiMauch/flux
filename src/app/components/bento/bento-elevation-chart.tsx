"use client";

import { useHover } from "./hover-context";

const NEON = "var(--activity-color, #FF6A00)";

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n >= 5 ? 5 : n >= 2 ? 2 : 1;
  return step * mag;
}

export function BentoElevationChart({
  route,
  width = 900,
  height = 280,
}: {
  route: RoutePoint[];
  width?: number;
  height?: number;
}) {
  const { hoverIdx, setHoverIdx } = useHover();

  // Keep only points with elevation but remember their original route index
  // so hover can map back to the full routeData array used by the map.
  const pts: { p: RoutePoint; origIdx: number }[] = [];
  route.forEach((p, i) => {
    if (typeof p.elevation === "number") pts.push({ p, origIdx: i });
  });
  if (pts.length < 2) return null;

  const dist: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    dist.push(dist[i - 1] + haversineKm(pts[i - 1].p, pts[i].p));
  }
  const totalKm = dist[dist.length - 1];

  const elevations = pts.map((x) => x.p.elevation as number);
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);
  const dy = Math.max(1, maxE - minE);

  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const r = (n: number) => Math.round(n * 100) / 100;
  const xAt = (km: number) => r(padL + (km / Math.max(1e-6, totalKm)) * plotW);
  const yAt = (el: number) => r(padT + plotH - ((el - minE) / dy) * plotH);

  const yStep = niceStep(dy, 4);
  const yTicks: number[] = [];
  const yStart = Math.ceil(minE / yStep) * yStep;
  for (let v = yStart; v <= maxE; v += yStep) yTicks.push(v);

  const xStep = niceStep(totalKm, 6);
  const xTicks: number[] = [];
  for (let v = 0; v <= totalKm + 1e-6; v += xStep) xTicks.push(v);

  let line = "";
  let area = `M${xAt(dist[0]).toFixed(1)},${(padT + plotH).toFixed(1)} `;
  pts.forEach((x, i) => {
    const px = xAt(dist[i]);
    const py = yAt(x.p.elevation as number);
    line += `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)} `;
    area += `L${px.toFixed(1)},${py.toFixed(1)} `;
  });
  area += `L${xAt(totalKm).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  // Hover-dependent values
  const hovered = (() => {
    if (hoverIdx == null) return null;
    // Find nearest elevation-point whose origIdx matches or is closest
    let bestI = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const diff = Math.abs(pts[i].origIdx - hoverIdx);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestI = i;
      }
    }
    if (bestI < 0) return null;
    return {
      km: dist[bestI],
      el: pts[bestI].p.elevation as number,
      x: xAt(dist[bestI]),
      y: yAt(pts[bestI].p.elevation as number),
    };
  })();

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    // Convert to viewBox coords (assumes preserveAspectRatio fills full container width)
    const xVb = (xPx / rect.width) * width;
    if (xVb < padL || xVb > width - padR) {
      setHoverIdx(null);
      return;
    }
    const km = ((xVb - padL) / plotW) * totalKm;
    // Find nearest elevation sample, then map back to original route index
    let bestI = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < dist.length; i++) {
      const d = Math.abs(dist[i] - km);
      if (d < bestDiff) {
        bestDiff = d;
        bestI = i;
      }
    }
    setHoverIdx(pts[bestI].origIdx);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full cursor-crosshair"
      onMouseMove={handleMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id="elev-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={NEON} stopOpacity="0.45" />
          <stop offset="100%" stopColor={NEON} stopOpacity="0" />
        </linearGradient>
        <filter id="neon-glow">
          <feGaussianBlur stdDeviation="2.5" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {yTicks.map((v) => {
        const y = yAt(v);
        return (
          <g key={`y${v}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="#3a3a3a"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={padL - 6}
              y={y + 3}
              fontSize={10}
              textAnchor="end"
              fill="#a3a3a3"
              fontFamily="var(--font-jetbrains), monospace"
            >
              {Math.round(v)} m
            </text>
          </g>
        );
      })}

      {xTicks.map((v) => {
        const x = xAt(v);
        return (
          <g key={`x${v}`}>
            <line
              x1={x}
              x2={x}
              y1={padT}
              y2={padT + plotH}
              stroke="#3a3a3a"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            <text
              x={x}
              y={padT + plotH + 14}
              fontSize={10}
              textAnchor="middle"
              fill="#a3a3a3"
              fontFamily="var(--font-jetbrains), monospace"
            >
              {v % 1 === 0 ? v : v.toFixed(1)} km
            </text>
          </g>
        );
      })}

      <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />
      <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />

      <path d={area} fill="url(#elev-grad)" />
      <path
        d={line}
        fill="none"
        stroke={NEON}
        strokeWidth={2.5}
        filter="url(#neon-glow)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Hover cursor */}
      {hovered && (
        <g>
          <line
            x1={hovered.x}
            x2={hovered.x}
            y1={padT}
            y2={padT + plotH}
            stroke="#ffffff"
            strokeWidth={1}
            strokeOpacity={0.6}
            strokeDasharray="3 3"
          />
          <circle
            cx={hovered.x}
            cy={hovered.y}
            r={5}
            fill={NEON}
            stroke="#ffffff"
            strokeWidth={1.5}
            style={{ filter: `drop-shadow(0 0 6px ${NEON})` }}
          />
          <rect
            x={Math.min(width - padR - 80, Math.max(padL, hovered.x - 40))}
            y={padT + 2}
            width={80}
            height={22}
            rx={4}
            fill="#000000"
            fillOpacity={0.7}
            stroke="#2a2a2a"
          />
          <text
            x={Math.min(width - padR - 40, Math.max(padL + 40, hovered.x))}
            y={padT + 17}
            fontSize={11}
            textAnchor="middle"
            fill="#ffffff"
            fontFamily="var(--font-jetbrains), monospace"
          >
            {hovered.el.toFixed(0)} m · {hovered.km.toFixed(2)} km
          </text>
        </g>
      )}
    </svg>
  );
}
