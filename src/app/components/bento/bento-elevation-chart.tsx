"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { segmentTypeAt, type ClimbSegment, type ClimbType } from "@/lib/climbs";
import { CLIMB_DOWN, CLIMB_UP } from "./climb-colors";
import { useHover } from "./hover-context";

const NEON = "var(--activity-color, #FF6A00)";

function colorForType(type: ClimbType | null): string {
  if (type === "up") return CLIMB_UP;
  if (type === "down") return CLIMB_DOWN;
  return NEON;
}

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  time?: string;
}

/** Seconds since start as h:mm:ss (or m:ss below an hour). */
function formatElapsed(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
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
  segments,
  width: fallbackWidth = 900,
  height: fallbackHeight = 280,
}: {
  route: RoutePoint[];
  /** Climb/descent segmentation; when given, the line is coloured by type. */
  segments?: ClimbSegment[];
  width?: number;
  height?: number;
}) {
  const { hoverIdx, setHoverIdx, selection } = useHover();

  // The viewBox is kept in sync with the rendered pixel size so one SVG unit
  // is one CSS pixel. Otherwise `preserveAspectRatio` scales the whole drawing
  // — including all labels — and the readouts end up unreadably small.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr || cr.width < 1 || cr.height < 1) return;
      setBox({ w: Math.round(cr.width), h: Math.round(cr.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = box?.w ?? fallbackWidth;
  const height = box?.h ?? fallbackHeight;

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

  // Elapsed time is measured against the first timestamped point of the whole
  // route, not just the first one carrying an elevation value.
  const startMs = (() => {
    for (const p of route) {
      if (!p.time) continue;
      const t = new Date(p.time).getTime();
      if (Number.isFinite(t)) return t;
    }
    return null;
  })();
  const elapsedAt = (i: number): number | null => {
    if (startMs == null) return null;
    const raw = pts[i].p.time;
    if (!raw) return null;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) return null;
    return (t - startMs) / 1000;
  };

  const elevations = pts.map((x) => x.p.elevation as number);
  const minE = Math.min(...elevations);
  const maxE = Math.max(...elevations);
  const dy = Math.max(1, maxE - minE);

  const padL = 46;
  const padR = 14;
  const padT = 14;
  const padB = 26;
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

  const px = pts.map((_, i) => xAt(dist[i]));
  const py = pts.map((x) => yAt(x.p.elevation as number));

  let area = `M${px[0].toFixed(1)},${(padT + plotH).toFixed(1)} `;
  for (let i = 0; i < px.length; i++) {
    area += `L${px[i].toFixed(1)},${py[i].toFixed(1)} `;
  }
  area += `L${xAt(totalKm).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;

  // Split the line into runs of equal segment type so each can carry its own
  // colour. Each run restarts at the previous run's last point, so they join
  // without a visible gap.
  const types: (ClimbType | null)[] = segments
    ? pts.map((x) => segmentTypeAt(segments, x.origIdx))
    : pts.map(() => null);

  const runs: { type: ClimbType | null; d: string }[] = [];
  let run = { type: types[0], d: `M${px[0].toFixed(1)},${py[0].toFixed(1)} ` };
  for (let i = 1; i < px.length; i++) {
    run.d += `L${px[i].toFixed(1)},${py[i].toFixed(1)} `;
    if (types[i] !== run.type && i < px.length - 1) {
      runs.push(run);
      run = { type: types[i], d: `M${px[i].toFixed(1)},${py[i].toFixed(1)} ` };
    }
  }
  runs.push(run);

  // Band marking the stretch selected in the kilometre or segment list.
  const band = (() => {
    const range = selection?.range;
    if (!range) return null;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const oi = pts[i].origIdx;
      if (oi < range[0] || oi > range[1]) continue;
      if (px[i] < lo) lo = px[i];
      if (px[i] > hi) hi = px[i];
    }
    if (!Number.isFinite(lo) || hi <= lo) return null;
    return { x: lo, w: hi - lo };
  })();

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
      elapsed: elapsedAt(bestI),
      x: xAt(dist[bestI]),
      y: yAt(pts[bestI].p.elevation as number),
    };
  })();

  // Readout pill: value/unit pairs laid out in one monospace line, sized from
  // the character count (JetBrains Mono advances ~0.6 em).
  const tip = (() => {
    if (!hovered) return null;
    const parts: { v: string; u: string }[] = [
      { v: hovered.el.toFixed(0), u: "m" },
      { v: hovered.km.toFixed(2), u: "km" },
    ];
    if (hovered.elapsed != null) {
      parts.push({ v: formatElapsed(hovered.elapsed), u: "" });
    }
    const SEP = "  ·  ";
    const plain = parts.map((p) => (p.u ? `${p.v} ${p.u}` : p.v)).join(SEP);
    const fontSize = 13;
    const w = Math.round(plain.length * fontSize * 0.6) + 22;
    const h = 26;
    const x = Math.max(4, Math.min(width - padR - w, hovered.x - w / 2));
    // Flip below the curve when the peak would sit underneath the pill.
    const y = hovered.y < padT + h + 22 ? padT + plotH - h - 6 : padT + 6;
    return { parts, sep: SEP, w, h, x, y, fontSize };
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
    <div ref={wrapRef} className="w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full h-full cursor-crosshair"
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
                fontSize={11}
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
                fontSize={11}
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

        {band && (
          <rect
            x={band.x}
            y={padT}
            width={band.w}
            height={plotH}
            fill="#ffffff"
            fillOpacity={0.08}
            stroke="#ffffff"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        )}

        {runs.map((r, i) => (
          <path
            key={i}
            d={r.d}
            fill="none"
            stroke={colorForType(r.type)}
            strokeWidth={2.5}
            filter="url(#neon-glow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

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
            {tip && (
              <g>
                <rect
                  x={tip.x}
                  y={tip.y}
                  width={tip.w}
                  height={tip.h}
                  rx={6}
                  fill="#0a0a0a"
                  fillOpacity={0.95}
                  stroke="#ffffff"
                  strokeOpacity={0.28}
                  strokeWidth={1}
                />
                <text
                  x={tip.x + tip.w / 2}
                  y={tip.y + tip.h / 2 + 1}
                  fontSize={tip.fontSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  letterSpacing="0.02em"
                  fontFamily="var(--font-jetbrains), monospace"
                  xmlSpace="preserve"
                >
                  {tip.parts.map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && <tspan fill="#5a5a5a">{tip.sep}</tspan>}
                      <tspan fill="#ffffff" fontWeight={600}>
                        {part.v}
                      </tspan>
                      {part.u && <tspan fill="#a3a3a3">{` ${part.u}`}</tspan>}
                    </Fragment>
                  ))}
                </text>
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
