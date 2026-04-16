"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";
const NEON_GREEN = "#39FF14";

interface Day {
  key: string;
  label: string;
  dateLabel: string;
  steps: number;
  isToday: boolean;
}

export function BentoDashboardStepsChart({ days }: { days: Day[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxSteps = Math.max(...days.map((d) => d.steps), 1);

  const W = 300;
  const H = 120;
  const padL = 6;
  const padR = 6;
  const padT = 10;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const dayW = plotW / days.length;
  const barW = dayW * 0.62;
  const r = (n: number) => Math.round(n * 100) / 100;
  const yAt = (v: number) => padT + plotH - (v / maxSteps) * plotH;

  const hover = hoverIdx != null ? days[hoverIdx] : null;

  return (
    <div className="relative flex-1 min-h-[120px]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="steps-bar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={NEON_GREEN} />
            <stop offset="100%" stopColor={NEON_GREEN} stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {days.map((d, i) => {
          const x = padL + i * dayW + (dayW - barW) / 2;
          const y = d.steps > 0 ? yAt(d.steps) : padT + plotH;
          const h = d.steps > 0 ? padT + plotH - y : 0;
          const isHover = hoverIdx === i;
          return (
            <g
              key={d.key}
              onMouseEnter={() => setHoverIdx(i)}
              style={{ cursor: d.steps > 0 ? "pointer" : "default" }}
            >
              {/* Full-height hit area for easy hover */}
              <rect
                x={r(padL + i * dayW)}
                y={padT}
                width={r(dayW)}
                height={plotH}
                fill="transparent"
              />
              {d.steps > 0 && (
                <rect
                  x={r(x)}
                  y={r(y)}
                  width={r(barW)}
                  height={r(h)}
                  fill="url(#steps-bar)"
                  rx={1.5}
                  style={{
                    filter: `drop-shadow(0 0 ${isHover ? 8 : 4}px ${NEON_GREEN}${isHover ? "cc" : "99"})`,
                    transition: "filter 0.15s ease",
                  }}
                />
              )}
              {d.isToday && (
                <rect
                  x={r(x - 1)}
                  y={padT}
                  width={r(barW + 2)}
                  height={plotH}
                  fill="none"
                  stroke={NEON}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                  strokeDasharray="2 2"
                  rx={1.5}
                />
              )}
              <text
                x={r(x + barW / 2)}
                y={padT + plotH + 12}
                fontSize={9}
                textAnchor="middle"
                fill={isHover ? "#ffffff" : d.isToday ? "#ffffff" : "#4a4a4a"}
                fontFamily="var(--bento-mono), monospace"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && hover.steps > 0 && hoverIdx != null && (
        <div
          className={`absolute top-0 -translate-x-1/2 pointer-events-none ${spaceMono.className} px-2.5 py-1.5 rounded-md border text-[11px] tabular-nums whitespace-nowrap`}
          style={{
            left: `${((hoverIdx + 0.5) / days.length) * 100}%`,
            borderColor: `${NEON_GREEN}77`,
            background: "rgba(10,10,10,0.92)",
            boxShadow: `0 0 12px ${NEON_GREEN}55`,
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ color: NEON_GREEN }}
          >
            {hover.dateLabel}
          </div>
          <div className="font-bold">
            {hover.steps.toLocaleString("de-CH")} Schritte
          </div>
        </div>
      )}
    </div>
  );
}
