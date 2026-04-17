"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

export interface WeekBar {
  start: string; // ISO date (Monday)
  count: number;
  week: number; // ISO week number
}

export function WeeklyBarsScope({
  weeks,
  maxWeek,
}: {
  weeks: WeekBar[];
  maxWeek: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 360;
  const H = 52;
  const padL = 4;
  const padR = 4;
  const padT = 4;
  const padB = 4;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slotW = plotW / weeks.length;
  const barW = slotW * 0.7;
  const r = (n: number) => Math.round(n * 100) / 100;

  const gridFrac = [0.5, 1];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const xVb = (xPx / rect.width) * W;
    if (xVb < padL || xVb > W - padR) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.min(
      weeks.length - 1,
      Math.max(0, Math.floor((xVb - padL) / slotW))
    );
    setHoverIdx(idx);
  }

  const hover = hoverIdx != null ? weeks[hoverIdx] : null;

  return (
    <div className="relative">
      <div
        className="relative overflow-hidden rounded-md border border-[#2a2a2a]"
        style={{
          height: 52,
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
            <linearGradient id="consistency-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={NEON} stopOpacity="0.75" />
              <stop offset="100%" stopColor={NEON} stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {gridFrac.map((f) => (
            <line
              key={`g${f}`}
              x1={padL}
              x2={W - padR}
              y1={padT + plotH * (1 - f)}
              y2={padT + plotH * (1 - f)}
              stroke={NEON}
              strokeOpacity="0.1"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {weeks.map((_, i) => (
            <line
              key={`vg${i}`}
              x1={padL + i * slotW + slotW / 2}
              x2={padL + i * slotW + slotW / 2}
              y1={padT}
              y2={padT + plotH}
              stroke={NEON}
              strokeOpacity="0.05"
              strokeWidth={1}
            />
          ))}

          <line
            x1={padL}
            x2={W - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={NEON}
            strokeOpacity="0.25"
            strokeWidth={1}
          />

          {weeks.map((w, i) => {
            const isCurrent = i === weeks.length - 1;
            const isHover = hoverIdx === i;
            const big = isCurrent || isHover;
            const h = maxWeek > 0 ? (w.count / maxWeek) * plotH : 0;
            const top = padT + plotH - h;
            const cx = padL + i * slotW + slotW / 2;
            const x = cx - barW / 2;
            if (w.count === 0) {
              return (
                <circle
                  key={i}
                  cx={r(cx)}
                  cy={padT + plotH}
                  r={isHover ? 2 : 1}
                  fill={NEON}
                  fillOpacity={isHover ? "0.6" : "0.25"}
                />
              );
            }
            return (
              <g key={i}>
                <rect
                  x={r(x)}
                  y={r(top)}
                  width={r(barW)}
                  height={r(h)}
                  fill="url(#consistency-bar)"
                  stroke={NEON}
                  strokeOpacity={big ? "0.8" : "0.45"}
                  strokeWidth={1}
                  rx={1}
                />
                <rect
                  x={r(x)}
                  y={r(top)}
                  width={r(barW)}
                  height={1.5}
                  fill={NEON}
                  style={{
                    filter: `drop-shadow(0 0 ${big ? 6 : 3}px ${NEON}) drop-shadow(0 0 ${big ? 12 : 6}px ${NEON}aa)`,
                  }}
                />
              </g>
            );
          })}

          {hoverIdx != null && (
            <line
              x1={padL + hoverIdx * slotW + slotW / 2}
              x2={padL + hoverIdx * slotW + slotW / 2}
              y1={padT}
              y2={padT + plotH}
              stroke={NEON}
              strokeOpacity={0.7}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          )}
        </svg>
      </div>

      {hover && hoverIdx != null && (
        <div
          className={`absolute -top-2 -translate-y-full -translate-x-1/2 pointer-events-none z-20 ${spaceMono.className} px-2 py-1 rounded border text-[10px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${((padL + (hoverIdx + 0.5) * slotW) / W) * 100}%`,
            borderColor: `${NEON}77`,
            background: "rgba(0,0,0,0.88)",
            boxShadow: `0 0 10px ${NEON}55`,
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: NEON, textShadow: `0 0 4px ${NEON}88` }}
          >
            KW {hover.week} ·{" "}
            {new Date(hover.start).toLocaleDateString("de-CH", {
              day: "2-digit",
              month: "short",
            })}
          </div>
          <div className="font-bold">
            {hover.count}{" "}
            <span className="text-[#9ca3af] text-[10px]">
              Aktiv.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
