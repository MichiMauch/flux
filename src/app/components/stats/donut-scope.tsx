"use client";

import { useState } from "react";
import { spaceMono } from "../bento/bento-fonts";
import { SevenSegDisplay } from "../bento/seven-seg";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  secondary?: string;
}

interface DonutScopeProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  unit?: string;
  size?: number;
  emptyLabel?: string;
}

export function DonutScope({
  slices,
  centerLabel,
  centerValue,
  unit,
  size = 180,
  emptyLabel = "Keine Daten",
}: DonutScopeProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const filtered = slices.filter((s) => s.value > 0);
  const total = filtered.reduce((s, x) => s + x.value, 0);

  if (filtered.length === 0 || total === 0) {
    return (
      <div
        className={`${spaceMono.className} relative flex items-center justify-center overflow-hidden rounded-md border border-[#2a2a2a] text-[10px] uppercase tracking-[0.2em] text-[#a3a3a3]`}
        style={{
          height: size,
          background: "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 20;
  const innerR = outerR - 28;
  const NEON = "#FF6A00";
  const r2 = (n: number) => Math.round(n * 100) / 100;

  let acc = 0;
  const arcs = filtered.map((s) => {
    const frac = s.value / total;
    const start = acc;
    acc += frac;
    const end = acc;
    return { ...s, start, end, frac };
  });

  // Radial ticks every 30°, major ticks every 90°
  const tickAngles = Array.from({ length: 12 }, (_, i) => i * 30);
  // Guide rings — all in visible zones (inside hole + outside slices)
  const holeR = innerR - 10;
  const outerRingR = outerR + 6;
  const outerRingR2 = outerR + 14;

  return (
    <div className="flex w-full flex-col items-center gap-4 md:grid md:grid-cols-2 md:items-center md:gap-4">
      <div
        className="relative aspect-square w-full overflow-hidden rounded-md border border-[#2a2a2a] mx-auto"
        style={{
          maxWidth: size,
          containerType: "inline-size",
          background:
            "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="relative w-full h-full"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <filter
              id="donut-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Inner guide ring (inside the hole) */}
          <circle
            cx={cx}
            cy={cy}
            r={holeR}
            fill="none"
            stroke={NEON}
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* Outer guide rings (outside the slices) */}
          <circle
            cx={cx}
            cy={cy}
            r={outerRingR}
            fill="none"
            stroke={NEON}
            strokeOpacity={0.6}
            strokeWidth={1.2}
            style={{ filter: `drop-shadow(0 0 2px ${NEON}88)` }}
          />
          <circle
            cx={cx}
            cy={cy}
            r={outerRingR2}
            fill="none"
            stroke={NEON}
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="2 4"
          />

          {/* Radial spokes — visible in hole and outside slices */}
          {tickAngles.map((deg) => {
            const rad = (deg - 90) * (Math.PI / 180);
            const isMajor = deg % 90 === 0;
            // Inner segment (inside hole)
            const ix1 = r2(cx + Math.cos(rad) * 4);
            const iy1 = r2(cy + Math.sin(rad) * 4);
            const ix2 = r2(cx + Math.cos(rad) * holeR);
            const iy2 = r2(cy + Math.sin(rad) * holeR);
            // Outer segment (between slice outer edge and outer ring)
            const ox1 = r2(cx + Math.cos(rad) * (outerR + 2));
            const oy1 = r2(cy + Math.sin(rad) * (outerR + 2));
            const ox2 = r2(cx + Math.cos(rad) * outerRingR2);
            const oy2 = r2(cy + Math.sin(rad) * outerRingR2);
            return (
              <g key={`spoke-${deg}`}>
                <line
                  x1={ix1}
                  y1={iy1}
                  x2={ix2}
                  y2={iy2}
                  stroke={NEON}
                  strokeOpacity={isMajor ? 0.6 : 0.25}
                  strokeWidth={1}
                  strokeDasharray={isMajor ? undefined : "2 3"}
                />
                <line
                  x1={ox1}
                  y1={oy1}
                  x2={ox2}
                  y2={oy2}
                  stroke={NEON}
                  strokeOpacity={isMajor ? 0.8 : 0.4}
                  strokeWidth={isMajor ? 1.2 : 1}
                  strokeDasharray={isMajor ? undefined : "2 3"}
                  style={
                    isMajor
                      ? { filter: `drop-shadow(0 0 2px ${NEON})` }
                      : undefined
                  }
                />
              </g>
            );
          })}

          {/* Tick marks beyond outer rings */}
          {tickAngles.map((deg) => {
            const rad = (deg - 90) * (Math.PI / 180);
            const isMajor = deg % 90 === 0;
            const len = isMajor ? 6 : 3;
            const x1 = r2(cx + Math.cos(rad) * (outerRingR2 + 2));
            const y1 = r2(cy + Math.sin(rad) * (outerRingR2 + 2));
            const x2 = r2(cx + Math.cos(rad) * (outerRingR2 + 2 + len));
            const y2 = r2(cy + Math.sin(rad) * (outerRingR2 + 2 + len));
            return (
              <line
                key={`tick-${deg}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={NEON}
                strokeOpacity={isMajor ? 0.9 : 0.5}
                strokeWidth={isMajor ? 1.5 : 1}
                style={
                  isMajor
                    ? { filter: `drop-shadow(0 0 3px ${NEON})` }
                    : undefined
                }
              />
            );
          })}

          {/* Slices — base fill with per-color neon glow */}
          {arcs.map((a, i) => {
            const isHover = hoverIdx === i;
            const r = isHover ? outerR + 2 : outerR;
            const ir = innerR;
            const path = donutSliceD(cx, cy, ir, r, a.start, a.end);
            return (
              <path
                key={`slice-${i}`}
                d={path}
                fill={a.color}
                fillOpacity={isHover ? 0.95 : 0.85}
                stroke={a.color}
                strokeOpacity={isHover ? 1 : 0.75}
                strokeWidth={isHover ? 2 : 1.2}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseMove={() => setHoverIdx(i)}
                style={{
                  cursor: "pointer",
                  transition: "fill-opacity 120ms",
                  filter: `drop-shadow(0 0 ${isHover ? 8 : 4}px ${a.color}) drop-shadow(0 0 ${isHover ? 16 : 10}px ${a.color}cc)`,
                }}
              />
            );
          })}

          {/* Bright outer-edge highlight arcs (like bar-top highlight) */}
          {arcs.map((a, i) => {
            const isHover = hoverIdx === i;
            const r = isHover ? outerR + 2 : outerR;
            const edgePath = donutSliceD(
              cx,
              cy,
              r - 2,
              r,
              a.start + 0.003,
              a.end - 0.003
            );
            return (
              <path
                key={`edge-${i}`}
                d={edgePath}
                fill={a.color}
                fillOpacity={1}
                pointerEvents="none"
                style={{
                  filter: `drop-shadow(0 0 ${isHover ? 6 : 3}px ${a.color}) drop-shadow(0 0 ${isHover ? 12 : 6}px ${a.color}aa)`,
                }}
              />
            );
          })}

          {/* Center dot / crosshair */}
          <circle
            cx={cx}
            cy={cy}
            r={1.5}
            fill={NEON}
            style={{
              filter: `drop-shadow(0 0 3px ${NEON}) drop-shadow(0 0 6px ${NEON}aa)`,
            }}
          />
        </svg>

        {(centerLabel || centerValue) && (
          <div
            className={`${spaceMono.className} absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center`}
          >
            {centerValue && (
              <div
                className="leading-none text-white"
                style={{
                  fontSize: "clamp(1.25rem, 18cqw, 3rem)",
                  filter: "drop-shadow(0 0 6px #FF6A00aa)",
                }}
              >
                <SevenSegDisplay value={centerValue} on="#FF6A00" off="#1a1a1a" />
              </div>
            )}
            {unit && (
              <div
                className="mt-0.5 font-bold uppercase tracking-[0.18em] text-[#a3a3a3]"
                style={{ fontSize: "clamp(8px, 4cqw, 11px)" }}
              >
                {unit}
              </div>
            )}
            {centerLabel && (
              <div
                className="mt-1 font-bold uppercase tracking-[0.22em] text-[#a3a3a3]"
                style={{ fontSize: "clamp(8px, 4cqw, 11px)" }}
              >
                {centerLabel}
              </div>
            )}
          </div>
        )}
      </div>

      <ul
        className={`${spaceMono.className} mt-3 md:mt-0 w-full md:flex-1 min-w-0 space-y-1 text-[11px]`}
      >
        {arcs.map((a, i) => {
          const isHover = hoverIdx === i;
          return (
            <li
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="flex items-center gap-2 rounded px-1 py-0.5 transition"
              style={
                isHover
                  ? {
                      background: "rgba(255,255,255,0.04)",
                      boxShadow: `inset 0 0 0 1px ${a.color}55`,
                    }
                  : undefined
              }
            >
              <span
                className="inline-block h-2 w-3 rounded-sm"
                style={{
                  background: a.color,
                  boxShadow: `0 0 6px ${a.color}`,
                }}
              />
              <span className="min-w-0 flex-1 truncate text-white">
                {a.label}
              </span>
              <span className="text-[#a3a3a3] tabular-nums">
                {(a.frac * 100).toFixed(0)}%
              </span>
              {a.secondary && (
                <span className="text-[#6b7280] tabular-nums text-[10px]">
                  {a.secondary}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function donutSliceD(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  startFrac: number,
  endFrac: number
): string {
  const TAU = Math.PI * 2;
  const a0 = startFrac * TAU - Math.PI / 2;
  const a1 = endFrac * TAU - Math.PI / 2;
  const large = endFrac - startFrac > 0.5 ? 1 : 0;
  const rn = (n: number) => Math.round(n * 100) / 100;
  const p0 = [rn(cx + Math.cos(a0) * r2), rn(cy + Math.sin(a0) * r2)];
  const p1 = [rn(cx + Math.cos(a1) * r2), rn(cy + Math.sin(a1) * r2)];
  const p2 = [rn(cx + Math.cos(a1) * r1), rn(cy + Math.sin(a1) * r1)];
  const p3 = [rn(cx + Math.cos(a0) * r1), rn(cy + Math.sin(a0) * r1)];
  return [
    `M ${p0[0]} ${p0[1]}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p1[0]} ${p1[1]}`,
    `L ${p2[0]} ${p2[1]}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p3[0]} ${p3[1]}`,
    `Z`,
  ].join(" ");
}
