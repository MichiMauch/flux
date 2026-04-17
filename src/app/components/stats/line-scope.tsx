"use client";

import { useState } from "react";
import { spaceMono } from "../bento/bento-fonts";

export interface LinePoint {
  label: string;
  value: number;
  formatted?: string;
}

interface LineScopeProps {
  points: LinePoint[];
  color: string;
  unit?: string;
  height?: number;
  yTickStep?: number;
  minY?: number;
  maxY?: number;
  emptyLabel?: string;
}

export function LineScope({
  points,
  color,
  unit = "",
  height = 160,
  yTickStep,
  minY,
  maxY,
  emptyLabel = "Keine Daten",
}: LineScopeProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return <EmptyChart height={height} color={color} label={emptyLabel} />;
  }

  const W = 640;
  const H = height;
  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const r = (n: number) => Math.round(n * 100) / 100;

  const values = points.map((p) => p.value);
  const rawMin = minY ?? Math.min(...values);
  const rawMax = maxY ?? Math.max(...values);
  const span = rawMax - rawMin;
  const pad = span === 0 ? Math.max(Math.abs(rawMax) * 0.1, 1) : span * 0.08;
  const yMin = minY ?? rawMin - pad;
  const yMax = maxY ?? rawMax + pad;
  const yRange = yMax - yMin || 1;

  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xAt = (i: number) =>
    points.length === 1 ? padL + plotW / 2 : padL + i * stepX;
  const yAt = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  let line = "";
  let area = "";
  points.forEach((p, i) => {
    const x = xAt(i);
    const y = yAt(p.value);
    line += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
    if (i === 0) area += `M${r(x)},${r(padT + plotH)} L${r(x)},${r(y)} `;
    else area += `L${r(x)},${r(y)} `;
  });
  area += `L${r(xAt(points.length - 1))},${r(padT + plotH)} Z`;

  const step = yTickStep ?? guessStep(yRange);
  const ticks: number[] = [];
  const firstTick = Math.ceil(yMin / step) * step;
  for (let v = firstTick; v <= yMax; v += step) ticks.push(v);

  const slug = color.replace("#", "");
  const gradId = `line-scope-grad-${slug}`;
  const glowId = `line-scope-glow-${slug}`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (xVb < padL - stepX / 2 || xVb > padL + (points.length - 1) * stepX + stepX / 2) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.round((xVb - padL) / Math.max(stepX, 1)))
    );
    setHoverIdx(idx);
  }

  const hover = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[#2a2a2a]"
      style={{
        height,
        background: "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
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
        viewBox={`0 0 ${W} ${H}`}
        className="relative w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
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

        {ticks.map((v) => (
          <g key={`tick-${v}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke={color}
              strokeOpacity="0.1"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={padL - 4}
              y={yAt(v) + 3}
              fontSize={9}
              textAnchor="end"
              fill={color}
              fillOpacity="0.6"
              fontFamily="var(--bento-mono), monospace"
            >
              {formatTick(v)}
            </text>
          </g>
        ))}

        <line
          x1={padL}
          x2={W - padR}
          y1={padT + plotH}
          y2={padT + plotH}
          stroke={color}
          strokeOpacity="0.25"
          strokeWidth={1}
        />

        <path d={area} fill={`url(#${gradId})`} />

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

        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          const isHover = hoverIdx === i;
          const big = isHover || isLast;
          const x = xAt(i);
          const y = yAt(p.value);
          return (
            <circle
              key={i}
              cx={r(x)}
              cy={r(y)}
              r={big ? 3.5 : 1.8}
              fill={big ? "#ffffff" : color}
              stroke={big ? color : "none"}
              strokeWidth={big ? 1.5 : 0}
              style={{
                filter: `drop-shadow(0 0 ${big ? 4 : 2}px ${color}) drop-shadow(0 0 ${big ? 8 : 4}px ${color}aa)`,
              }}
            />
          );
        })}

        {/* X axis labels — show first, middle, last */}
        {xAxisLabelIndexes(points.length).map((i) => (
          <text
            key={`xl-${i}`}
            x={r(xAt(i))}
            y={padT + plotH + 14}
            fontSize={9}
            textAnchor="middle"
            fill={color}
            fillOpacity="0.6"
            fontFamily="var(--bento-mono), monospace"
          >
            {points[i].label}
          </text>
        ))}

        {hoverIdx != null && (
          <line
            x1={xAt(hoverIdx)}
            x2={xAt(hoverIdx)}
            y1={padT}
            y2={padT + plotH}
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hover && hoverIdx != null && (
        <div
          className={`absolute top-1 -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2.5 py-1.5 rounded border text-[11px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${(xAt(hoverIdx) / W) * 100}%`,
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
            {hover.label}
          </div>
          <div className="font-bold">
            {hover.formatted ?? formatTick(hover.value)}
            {unit && <span className="text-[#9ca3af] text-[10px] ml-1">{unit}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function guessStep(range: number): number {
  if (range <= 2) return 0.5;
  if (range <= 10) return 1;
  if (range <= 40) return 5;
  if (range <= 100) return 10;
  if (range <= 400) return 50;
  if (range <= 1000) return 100;
  if (range <= 5000) return 500;
  return 1000;
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function xAxisLabelIndexes(n: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [0];
  if (n === 2) return [0, 1];
  if (n <= 6) return Array.from({ length: n }, (_, i) => i);
  return [0, Math.floor(n / 2), n - 1];
}

function EmptyChart({
  height,
  color,
  label,
}: {
  height: number;
  color: string;
  label: string;
}) {
  return (
    <div
      className={`${spaceMono.className} relative flex items-center justify-center overflow-hidden rounded-md border border-[#2a2a2a] text-[10px] uppercase tracking-[0.2em]`}
      style={{
        height,
        background: "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
        color: `${color}99`,
        textShadow: `0 0 6px ${color}66`,
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
      <span className="relative">{label}</span>
    </div>
  );
}
