"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

interface Point {
  date: string | Date;
  weight: number;
}

export function WeightSparkline({ points }: { points: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) return null;

  const minW = Math.min(...points.map((p) => p.weight));
  const maxW = Math.max(...points.map((p) => p.weight));
  const dy = Math.max(0.1, maxW - minW);

  // Nice ticks bracketing the data
  const step =
    dy > 40 ? 10 : dy > 20 ? 5 : dy > 8 ? 2 : dy > 3 ? 1 : 0.5;
  const yMin = Math.floor(minW / step) * step;
  const yMax = Math.ceil(maxW / step) * step;
  const yRange = Math.max(step, yMax - yMin);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 0.001; v += step) ticks.push(v);

  // Same viewBox proportions as MonthLineChart so fonts render identically
  // under preserveAspectRatio="none"
  const W = 360;
  const H = 110;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 8;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const stepX = plotW / Math.max(1, points.length - 1);
  const r = (n: number) => Math.round(n * 100) / 100;
  const xAt = (i: number) => padL + i * stepX;
  const yAt = (v: number) =>
    padT + plotH - ((v - yMin) / yRange) * plotH;

  let line = "";
  let area = `M${r(padL)},${r(padT + plotH)} `;
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.weight);
    line += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
    area += `L${r(x)},${r(y)} `;
  });
  area += `L${r(padL + (points.length - 1) * stepX)},${r(padT + plotH)} Z`;

  // Vertical gridlines: one per measurement + bolder ones at month boundaries
  const vLines: { x: number; major: boolean }[] = [];
  let lastMonth = -1;
  points.forEach((p, i) => {
    const m = new Date(p.date).getMonth();
    const major = m !== lastMonth;
    vLines.push({ x: xAt(i), major });
    lastMonth = m;
  });

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (
      xVb < padL - stepX / 2 ||
      xVb > padL + (points.length - 1) * stepX + stepX / 2
    ) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.round((xVb - padL) / stepX);
    if (idx >= 0 && idx < points.length) setHoverIdx(idx);
    else setHoverIdx(null);
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div className="relative flex-1 min-h-0">
      <div
        className="absolute inset-0 overflow-hidden rounded-md border border-[#2a2a2a]"
        style={{
          background:
            "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
          }}
        />

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative w-full h-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="weight-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={NEON} stopOpacity="0.45" />
              <stop offset="100%" stopColor={NEON} stopOpacity="0" />
            </linearGradient>
            <filter
              id="weight-glow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Vertical grid — one per measurement (major at month boundaries) */}
          {vLines.map((v, i) => (
            <line
              key={`vg${i}`}
              x1={v.x}
              x2={v.x}
              y1={padT}
              y2={padT + plotH}
              stroke={NEON}
              strokeOpacity={v.major ? 0.22 : 0.08}
              strokeWidth={1}
            />
          ))}

          {/* Horizontal grid */}
          {ticks.map((v) => (
            <line
              key={`g${v}`}
              x1={padL}
              x2={W - padR}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke={NEON}
              strokeOpacity="0.12"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {/* Y-axis labels — only every other tick */}
          {ticks.map((v, i) =>
            i % 2 === 0 ? (
              <text
                key={`yl${v}`}
                x={padL - 4}
                y={yAt(v) + 3}
                fontSize={9}
                textAnchor="end"
                fill={NEON}
                fillOpacity="0.7"
                fontFamily="var(--bento-mono), monospace"
              >
                {v % 1 === 0 ? v : v.toFixed(1)}
              </text>
            ) : null
          )}

          {/* Baseline */}
          <line
            x1={padL}
            x2={W - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={NEON}
            strokeOpacity="0.25"
            strokeWidth={1}
          />

          {/* Area fill */}
          <path d={area} fill="url(#weight-grad)" />

          {/* Trace — halo + core */}
          <path
            d={line}
            fill="none"
            stroke={NEON}
            strokeOpacity="0.4"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#weight-glow)"
          />
          <path
            d={line}
            fill="none"
            stroke={NEON}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: `drop-shadow(0 0 2px ${NEON}) drop-shadow(0 0 4px ${NEON}aa)`,
            }}
          />

          {hoverIdx != null && (
            <>
              <line
                x1={xAt(hoverIdx)}
                x2={xAt(hoverIdx)}
                y1={padT}
                y2={padT + plotH}
                stroke={NEON}
                strokeWidth={1}
                strokeOpacity={0.7}
                strokeDasharray="2 2"
              />
              <circle
                cx={xAt(hoverIdx)}
                cy={yAt(points[hoverIdx].weight)}
                r={3.5}
                fill="#ffffff"
                stroke={NEON}
                strokeWidth={1.2}
                style={{
                  filter: `drop-shadow(0 0 4px ${NEON}) drop-shadow(0 0 8px ${NEON})`,
                }}
              />
            </>
          )}
        </svg>
      </div>

      {hover && hoverIdx != null && (
        <div
          className={`absolute top-1 -translate-x-1/2 pointer-events-none z-20 ${spaceMono.className} px-2 py-1 rounded border text-[10px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${Math.min(
              85,
              Math.max(15, ((padL + hoverIdx * stepX) / W) * 100)
            )}%`,
            borderColor: `${NEON}77`,
            background: "rgba(0,0,0,0.88)",
            boxShadow: `0 0 10px ${NEON}55`,
            color: "#ffffff",
          }}
        >
          <span className="font-bold">{hover.weight.toFixed(1)} kg</span>
          <span className="text-[#9ca3af] ml-1.5">
            {new Date(hover.date).toLocaleDateString("de-CH", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
