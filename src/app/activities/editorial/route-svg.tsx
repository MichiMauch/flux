"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Point {
  lat: number;
  lng: number;
}

interface Props {
  route: unknown;
  color: string;
  /** Rendering strokeWidth in viewBox units (viewBox is 1000x600). */
  strokeWidth?: number;
  /** Inner padding in viewBox units to avoid the path kissing the edge. */
  padding?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Intensity of the neon glow (drop-shadow opacity 0..1). */
  glow?: number;
}

const VB_W = 1000;
const VB_H = 600;

function haversineMeters(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Douglas-Peucker polyline simplification on raw lat/lng in a local
 * equirectangular space (scaled by cos(midLat)). Epsilon is in the same
 * local units. Iterative to avoid deep recursion for large tracks.
 */
function simplify(points: Point[], epsilon: number, midLat: number): Point[] {
  if (points.length < 3) return points.slice();
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

/**
 * Drop GPS acquisition spikes at the very start and end of a track.
 * Estimates a "normal" segment distance from the middle 50 % of the track
 * and removes leading/trailing points whose hop to the next is more than
 * 5× that median (or 50 m, whichever is larger). Never trims more than 5 %
 * of the track to stay safe on genuinely short activities.
 */
function trimSpikes(points: Point[]): Point[] {
  if (points.length < 30) return points;

  const qLo = Math.floor(points.length * 0.25);
  const qHi = Math.floor(points.length * 0.75);
  const segs: number[] = [];
  for (let i = qLo + 1; i <= qHi; i++) {
    segs.push(haversineMeters(points[i - 1], points[i]));
  }
  segs.sort((a, b) => a - b);
  const median = segs[Math.floor(segs.length / 2)] || 10;
  const threshold = Math.max(50, median * 5);

  const maxTrim = Math.floor(points.length * 0.05);

  let start = 0;
  while (
    start < maxTrim &&
    haversineMeters(points[start], points[start + 1]) > threshold
  ) {
    start++;
  }

  let end = points.length - 1;
  const minEnd = points.length - 1 - maxTrim;
  while (
    end > minEnd &&
    haversineMeters(points[end - 1], points[end]) > threshold
  ) {
    end--;
  }

  if (start === 0 && end === points.length - 1) return points;
  return points.slice(start, end + 1);
}

function buildPath(
  points: Point[],
  width: number,
  height: number,
  padding: number,
  closeIfNearStart: boolean
): { d: string; closed: boolean } {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const dx = (maxLng - minLng) * lngScale || 1e-9;
  const dy = maxLat - minLat || 1e-9;
  const innerW = width - 2 * padding;
  const innerH = height - 2 * padding;
  const scale = Math.min(innerW / dx, innerH / dy);
  const contentW = dx * scale;
  const contentH = dy * scale;
  const offsetX = padding + (innerW - contentW) / 2;
  const offsetY = padding + (innerH - contentH) / 2;

  const project = (p: Point) => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    y: offsetY + (maxLat - p.lat) * scale,
  });

  let out = "";
  for (let i = 0; i < points.length; i++) {
    const { x, y } = project(points[i]);
    out += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }

  let closed = false;
  if (closeIfNearStart && points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    const gapMeters = haversineMeters(first, last);
    const diagMeters = haversineMeters(
      { lat: minLat, lng: minLng },
      { lat: maxLat, lng: maxLng }
    );
    // A loop's start/end is close relative to the extent of the track.
    // 40 % of the bbox diagonal (min 1500 m) catches loops that end a few km
    // away from the start (parking changes, GPS drift, different trailhead).
    // A→B routes have gap ≈ diagonal and stay open.
    const threshold = Math.max(1500, diagMeters * 0.4);
    if (gapMeters <= threshold) {
      out += "Z";
      closed = true;
    }
  }

  return { d: out.trim(), closed };
}

/**
 * Simple moving-average smoothing in local equirectangular space.
 * Reduces GPS jitter and merges near-parallel out-and-back tracks so the
 * editorial silhouette reads as one clean line.
 */
function smooth(points: Point[], window: number): Point[] {
  if (points.length < 3 || window < 2) return points;
  const w = Math.min(window, points.length);
  const half = Math.floor(w / 2);
  const out: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i++) {
    let sumLat = 0;
    let sumLng = 0;
    let n = 0;
    const lo = Math.max(0, i - half);
    const hi = Math.min(points.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      sumLat += points[j].lat;
      sumLng += points[j].lng;
      n++;
    }
    out[i] = { lat: sumLat / n, lng: sumLng / n };
  }
  // Keep original endpoints so close-detection uses real GPS start/end.
  out[0] = points[0];
  out[out.length - 1] = points[points.length - 1];
  return out;
}

export function RouteSvg({
  route,
  color,
  strokeWidth = 14,
  padding = 24,
  className,
  style,
  glow = 0.55,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [animated, setAnimated] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const built = useMemo(() => {
    if (!Array.isArray(route) || route.length < 2) {
      return { d: "", closed: false };
    }
    const raw = (route as Point[]).filter(
      (p) => typeof p?.lat === "number" && typeof p?.lng === "number"
    );
    if (raw.length < 2) {
      return { d: "", closed: false };
    }

    // Drop GPS acquisition spikes at start/end before any other processing.
    const trimmed = trimSpikes(raw);

    // bbox for tolerance in degrees
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const p of trimmed) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    const midLat = (minLat + maxLat) / 2;
    const lngScale = Math.cos((midLat * Math.PI) / 180);
    const dxDeg = (maxLng - minLng) * lngScale || 1e-9;
    const dyDeg = maxLat - minLat || 1e-9;
    const diagDeg = Math.sqrt(dxDeg * dxDeg + dyDeg * dyDeg);

    const windowSize = Math.max(
      3,
      Math.min(15, Math.floor(trimmed.length / 200))
    );
    const smoothed = smooth(trimmed, windowSize);

    const epsilon = diagDeg * 0.003;
    const simplified = simplify(smoothed, epsilon, midLat);

    const HARD_CAP = 2000;
    let finalPoints = simplified;
    if (simplified.length > HARD_CAP) {
      const step = Math.ceil(simplified.length / HARD_CAP);
      const out: Point[] = [];
      for (let i = 0; i < simplified.length; i += step) out.push(simplified[i]);
      const last = simplified[simplified.length - 1];
      const tip = out[out.length - 1];
      if (!tip || tip.lat !== last.lat || tip.lng !== last.lng) out.push(last);
      finalPoints = out;
    }

    return buildPath(finalPoints, VB_W, VB_H, padding, true);
  }, [route, padding]);

  const d = built.d;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !d || drawn) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setDrawn(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    obs.observe(svg);
    return () => obs.disconnect();
  }, [d, drawn]);

  if (!d) return null;

  const alpha1 = Math.round(Math.min(1, Math.max(0, glow)) * 255)
    .toString(16)
    .padStart(2, "0");
  const alpha2 = Math.round(Math.min(1, Math.max(0, glow * 0.6)) * 255)
    .toString(16)
    .padStart(2, "0");

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{
        filter: `drop-shadow(0 0 10px ${color}${alpha1}) drop-shadow(0 0 28px ${color}${alpha2})`,
        ...style,
      }}
      aria-hidden
    >
      {built.closed && (
        <path
          d={d}
          fill={color}
          fillOpacity={0.14}
          stroke="none"
          style={{
            opacity: drawn ? 1 : 0,
            transition: "opacity 1200ms ease 600ms",
          }}
          pointerEvents="none"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength={animated ? undefined : 1000}
        style={{
          strokeDasharray: animated ? "none" : 1000,
          strokeDashoffset: animated ? 0 : drawn ? 0 : 1000,
          transition: animated
            ? "none"
            : "stroke-dashoffset 1800ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onTransitionEnd={(e) => {
          if (e.propertyName === "stroke-dashoffset" && drawn) {
            setAnimated(true);
          }
        }}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
