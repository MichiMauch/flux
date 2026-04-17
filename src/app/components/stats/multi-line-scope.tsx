"use client";

import { useState } from "react";
import { spaceMono } from "../bento/bento-fonts";

export interface MultiSeries {
  name: string;
  color: string;
  values: number[];
  unit?: string;
}

export interface MultiLineProps {
  labels: string[];
  series: MultiSeries[];
  height?: number;
  emptyLabel?: string;
}

export function MultiLineScope({
  labels,
  series,
  height = 160,
  emptyLabel = "Keine Daten",
}: MultiLineProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (labels.length === 0 || series.length === 0) {
    return <EmptyChart height={height} label={emptyLabel} />;
  }

  const W = 640;
  const H = height;
  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const r = (n: number) => Math.round(n * 100) / 100;

  const allValues = series.flatMap((s) => s.values);
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin;
  const pad = span === 0 ? Math.max(Math.abs(rawMax) * 0.1, 1) : span * 0.08;
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;
  const yRange = yMax - yMin || 1;

  const stepX = labels.length > 1 ? plotW / (labels.length - 1) : 0;
  const xAt = (i: number) =>
    labels.length === 1 ? padL + plotW / 2 : padL + i * stepX;
  const yAt = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const step = guessStep(yRange);
  const ticks: number[] = [];
  const firstTick = Math.ceil(yMin / step) * step;
  for (let v = firstTick; v <= yMax; v += step) ticks.push(v);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (xVb < padL - stepX / 2 || xVb > padL + (labels.length - 1) * stepX + stepX / 2) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.min(
      labels.length - 1,
      Math.max(0, Math.round((xVb - padL) / Math.max(stepX, 1)))
    );
    setHoverIdx(idx);
  }

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
          {series.map((s) => {
            const slug = s.color.replace("#", "");
            return (
              <filter
                key={slug}
                id={`ml-glow-${slug}`}
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
            );
          })}
        </defs>

        {ticks.map((v) => (
          <g key={`tick-${v}`}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="#FF6A00"
              strokeOpacity="0.08"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text
              x={padL - 4}
              y={yAt(v) + 3}
              fontSize={9}
              textAnchor="end"
              fill="#a3a3a3"
              fillOpacity="0.7"
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
          stroke="#FF6A00"
          strokeOpacity="0.2"
          strokeWidth={1}
        />

        {series.map((s) => {
          const slug = s.color.replace("#", "");
          let d = "";
          s.values.forEach((v, i) => {
            const x = xAt(i);
            const y = yAt(v);
            d += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
          });
          return (
            <g key={s.name}>
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeOpacity="0.35"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#ml-glow-${slug})`}
              />
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: `drop-shadow(0 0 2px ${s.color}) drop-shadow(0 0 4px ${s.color}aa)`,
                }}
              />
            </g>
          );
        })}

        {xAxisLabelIndexes(labels.length).map((i) => (
          <text
            key={`xl-${i}`}
            x={r(xAt(i))}
            y={padT + plotH + 14}
            fontSize={9}
            textAnchor="middle"
            fill="#a3a3a3"
            fillOpacity="0.7"
            fontFamily="var(--bento-mono), monospace"
          >
            {labels[i]}
          </text>
        ))}

        {hoverIdx != null &&
          series.map((s) => {
            const v = s.values[hoverIdx];
            return (
              <circle
                key={`hc-${s.name}`}
                cx={r(xAt(hoverIdx))}
                cy={r(yAt(v))}
                r={4}
                fill="#ffffff"
                stroke={s.color}
                strokeWidth={1.5}
                style={{
                  filter: `drop-shadow(0 0 4px ${s.color}) drop-shadow(0 0 8px ${s.color}aa)`,
                }}
              />
            );
          })}

        {hoverIdx != null && (
          <line
            x1={xAt(hoverIdx)}
            x2={xAt(hoverIdx)}
            y1={padT}
            y2={padT + plotH}
            stroke="#FF6A00"
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {/* Legend */}
      <div
        className={`${spaceMono.className} absolute top-1 right-2 flex gap-2 text-[9px] uppercase tracking-[0.14em]`}
      >
        {series.map((s) => (
          <span
            key={s.name}
            className="flex items-center gap-1"
            style={{ color: s.color, textShadow: `0 0 4px ${s.color}77` }}
          >
            <span
              className="inline-block h-1 w-2"
              style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }}
            />
            {s.name}
          </span>
        ))}
      </div>

      {hoverIdx != null && (
        <div
          className={`absolute top-6 -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2.5 py-1.5 rounded border text-[11px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${(xAt(hoverIdx) / W) * 100}%`,
            borderColor: "#FF6A0077",
            background: "rgba(0,0,0,0.88)",
            boxShadow: "0 0 12px rgba(255,106,0,0.3)",
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#FF6A00", textShadow: "0 0 4px #FF6A0088" }}
          >
            {labels[hoverIdx]}
          </div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2 font-bold">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{
                  background: s.color,
                  boxShadow: `0 0 4px ${s.color}`,
                }}
              />
              <span className="text-[#9ca3af] text-[9px] uppercase">
                {s.name}
              </span>
              <span>{formatTick(s.values[hoverIdx])}</span>
              {s.unit && (
                <span className="text-[#9ca3af] text-[10px]">{s.unit}</span>
              )}
            </div>
          ))}
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
  return 500;
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

function EmptyChart({ height, label }: { height: number; label: string }) {
  return (
    <div
      className={`${spaceMono.className} relative flex items-center justify-center overflow-hidden rounded-md border border-[#2a2a2a] text-[10px] uppercase tracking-[0.2em] text-[#a3a3a3]`}
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
      <span className="relative">{label}</span>
    </div>
  );
}
