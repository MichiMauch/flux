"use client";

import { useState } from "react";
import { spaceMono } from "../bento/bento-fonts";

export interface BarPoint {
  label: string;
  value: number;
  formatted?: string;
}

interface BarsScopeProps {
  bars: BarPoint[];
  color: string;
  unit?: string;
  height?: number;
  emptyLabel?: string;
}

export function BarsScope({
  bars,
  color,
  unit = "",
  height = 160,
  emptyLabel = "Keine Daten",
}: BarsScopeProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (bars.length === 0) {
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
  const slotW = plotW / bars.length;
  const barW = Math.min(slotW * 0.72, 18);
  const r = (n: number) => Math.round(n * 100) / 100;

  const maxV = Math.max(...bars.map((b) => b.value), 1);
  const yAt = (v: number) => padT + plotH - (v / maxV) * plotH;

  const step = guessStep(maxV);
  const ticks: number[] = [];
  for (let v = step; v <= maxV; v += step) ticks.push(v);

  const slug = color.replace("#", "");
  const gradId = `bars-scope-grad-${slug}`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (xVb < padL || xVb > W - padR) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.min(
      bars.length - 1,
      Math.max(0, Math.floor((xVb - padL) / slotW))
    );
    setHoverIdx(idx);
  }

  const hover = hoverIdx != null ? bars[hoverIdx] : null;

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
            <stop offset="0%" stopColor={color} stopOpacity="0.75" />
            <stop offset="100%" stopColor={color} stopOpacity="0.08" />
          </linearGradient>
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

        {bars.map((b, i) => {
          const isHover = hoverIdx === i;
          const big = isHover;
          if (b.value === 0) return null;
          const h = (b.value / maxV) * plotH;
          const top = padT + plotH - h;
          const cx = padL + i * slotW + slotW / 2;
          const x = cx - barW / 2;
          return (
            <g key={i}>
              <rect
                x={r(x)}
                y={r(top)}
                width={r(barW)}
                height={r(h)}
                fill={`url(#${gradId})`}
                stroke={color}
                strokeOpacity={big ? "0.8" : "0.45"}
                strokeWidth={1}
                rx={1}
              />
              <rect
                x={r(x)}
                y={r(top)}
                width={r(barW)}
                height={1.5}
                fill={color}
                style={{
                  filter: `drop-shadow(0 0 ${big ? 6 : 3}px ${color}) drop-shadow(0 0 ${big ? 12 : 6}px ${color}aa)`,
                }}
              />
            </g>
          );
        })}

        {xAxisLabelIndexes(bars.length).map((i) => (
          <text
            key={`xl-${i}`}
            x={r(padL + i * slotW + slotW / 2)}
            y={padT + plotH + 14}
            fontSize={9}
            textAnchor="middle"
            fill={color}
            fillOpacity="0.6"
            fontFamily="var(--bento-mono), monospace"
          >
            {bars[i].label}
          </text>
        ))}

        {hoverIdx != null && (
          <line
            x1={padL + hoverIdx * slotW + slotW / 2}
            x2={padL + hoverIdx * slotW + slotW / 2}
            y1={padT}
            y2={padT + plotH}
            stroke={color}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {hover && hoverIdx != null && (
        <div
          className={`absolute top-1 -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2.5 py-1.5 rounded border text-[11px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${((padL + (hoverIdx + 0.5) * slotW) / W) * 100}%`,
            borderColor: `${color}77`,
            background: "rgba(0,0,0,0.88)",
            boxShadow: `0 0 10px ${color}55`,
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

function guessStep(max: number): number {
  if (max <= 5) return 1;
  if (max <= 20) return 5;
  if (max <= 100) return 25;
  if (max <= 500) return 100;
  if (max <= 2000) return 500;
  if (max <= 10000) return 2500;
  if (max <= 50000) return 10000;
  return 25000;
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
