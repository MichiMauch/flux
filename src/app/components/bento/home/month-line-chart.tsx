"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const MONTHS_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTHS_FULL = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export function MonthLineChart({
  values,
  color,
  currentMonth,
  formattedValues,
  unit,
}: {
  values: number[];
  color: string;
  currentMonth: number;
  formattedValues: string[];
  unit: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 360;
  const H = 110;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 16;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const stepX = plotW / 11;
  const r = (n: number) => Math.round(n * 100) / 100;
  const maxV = Math.max(...values, 1);
  const yAt = (v: number) => padT + plotH - (v / maxV) * plotH;

  let line = "";
  let area = `M${r(padL)},${r(padT + plotH)} `;
  values.forEach((v, i) => {
    const x = padL + i * stepX;
    const y = yAt(v);
    line += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
    area += `L${r(x)},${r(y)} `;
  });
  area += `L${r(padL + 11 * stepX)},${r(padT + plotH)} Z`;

  // Y ticks
  const step =
    maxV > 500 ? 250 : maxV > 200 ? 100 : maxV > 50 ? 25 : maxV > 10 ? 5 : maxV > 5 ? 2 : 1;
  const ticks: number[] = [];
  for (let v = step; v <= maxV; v += step) ticks.push(v);

  const gradId = `month-line-grad-${color.replace("#", "")}`;
  const glowId = `month-line-glow-${color.replace("#", "")}`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (xVb < padL - stepX / 2 || xVb > padL + 11 * stepX + stepX / 2) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.round((xVb - padL) / stepX);
    if (idx >= 0 && idx < values.length) setHoverIdx(idx);
  }

  return (
    <div
      className="relative flex-1 min-h-[110px] overflow-hidden rounded-md border border-[#2a2a2a]"
      style={{
        background:
          "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
      }}
    >
      {/* Scanlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
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
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Vertical grid per month */}
        {MONTHS_SHORT.map((_, i) => (
          <line
            key={`vg${i}`}
            x1={padL + i * stepX}
            x2={padL + i * stepX}
            y1={padT}
            y2={padT + plotH}
            stroke={color}
            strokeOpacity="0.05"
            strokeWidth={1}
          />
        ))}

        {/* Horizontal grid */}
        {ticks.map((v) => (
          <line
            key={v}
            x1={padL}
            x2={W - padR}
            y1={yAt(v)}
            y2={yAt(v)}
            stroke={color}
            strokeOpacity="0.12"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}

        {/* Y-axis labels */}
        {ticks.map((v) => (
          <text
            key={`lbl${v}`}
            x={padL - 4}
            y={yAt(v) + 3}
            fontSize={9}
            textAnchor="end"
            fill={color}
            fillOpacity="0.7"
            fontFamily="var(--bento-mono), monospace"
          >
            {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          </text>
        ))}

        {/* Baseline */}
        <line
          x1={padL}
          x2={W - padR}
          y1={padT + plotH}
          y2={padT + plotH}
          stroke={color}
          strokeOpacity="0.25"
          strokeWidth={1}
        />

        {/* Area fill */}
        <path d={area} fill={`url(#${gradId})`} />

        {/* Trace — halo + core */}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeOpacity="0.4"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 4px ${color}aa)`,
          }}
        />

        {/* Dots */}
        {values.map((v, i) => {
          const x = padL + i * stepX;
          const y = yAt(v);
          const isCurrent = i === currentMonth;
          const isHover = hoverIdx === i;
          const big = isHover || isCurrent;
          return (
            <g key={i}>
              <circle
                cx={r(x)}
                cy={r(y)}
                r={big ? 3.5 : 2}
                fill={big ? "#ffffff" : color}
                stroke={big ? color : "none"}
                strokeWidth={big ? 1.5 : 0}
                style={{
                  filter: `drop-shadow(0 0 ${big ? 4 : 2}px ${color}) drop-shadow(0 0 ${big ? 8 : 4}px ${color}aa)`,
                }}
              />
              <text
                x={r(x)}
                y={padT + plotH + 12}
                fontSize={9}
                textAnchor="middle"
                fill={isHover || isCurrent ? color : color}
                fillOpacity={isHover || isCurrent ? 1 : 0.45}
                fontFamily="var(--bento-mono), monospace"
                style={
                  isHover || isCurrent
                    ? { filter: `drop-shadow(0 0 3px ${color})` }
                    : undefined
                }
              >
                {MONTHS_SHORT[i]}
              </text>
            </g>
          );
        })}

        {/* Hover crosshair */}
        {hoverIdx != null && (
          <line
            x1={padL + hoverIdx * stepX}
            x2={padL + hoverIdx * stepX}
            y1={padT}
            y2={padT + plotH}
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hoverIdx != null && (
        <div
          className={`absolute top-0 -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2.5 py-1.5 rounded border text-[11px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${((hoverIdx + 0.5) / 12) * 100}%`,
            borderColor: `${color}77`,
            background: "rgba(0,0,0,0.85)",
            boxShadow: `0 0 12px ${color}55`,
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color, textShadow: `0 0 4px ${color}88` }}
          >
            {MONTHS_FULL[hoverIdx]}
          </div>
          <div className="font-bold">
            {formattedValues[hoverIdx]}{" "}
            <span className="text-[#9ca3af] text-[10px]">{unit}</span>
          </div>
        </div>
      )}
    </div>
  );
}
