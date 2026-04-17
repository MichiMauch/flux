"use client";

import { useState } from "react";
import { spaceMono } from "../bento-fonts";

const GREEN = "#39FF14";

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

  // Same viewBox proportions as MonthLineChart so fonts render consistently
  // under preserveAspectRatio="none"
  const W = 360;
  const H = 110;
  const padL = 32;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const dayW = plotW / days.length;
  const barW = dayW * 0.55;
  const r = (n: number) => Math.round(n * 100) / 100;
  const yAt = (v: number) => padT + plotH - (v / maxSteps) * plotH;

  // Y ticks
  const step =
    maxSteps > 30000
      ? 10000
      : maxSteps > 15000
        ? 5000
        : maxSteps > 6000
          ? 2000
          : 1000;
  const ticks: number[] = [];
  for (let v = step; v <= maxSteps; v += step) ticks.push(v);

  const hover = hoverIdx != null ? days[hoverIdx] : null;

  return (
    <div className="relative flex-1 min-h-[120px]">
      <div
        className="absolute inset-0 overflow-hidden rounded-md border border-[#2a2a2a]"
        style={{
          background:
            "radial-gradient(ellipse at center, #011a06 0%, #000 70%)",
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
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="steps-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity="0.75" />
              <stop offset="100%" stopColor={GREEN} stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Vertical grid — one per day */}
          {days.map((_, i) => (
            <line
              key={`vg${i}`}
              x1={padL + i * dayW + dayW / 2}
              x2={padL + i * dayW + dayW / 2}
              y1={padT}
              y2={padT + plotH}
              stroke={GREEN}
              strokeOpacity="0.08"
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
              stroke={GREEN}
              strokeOpacity="0.12"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {/* Y-axis labels */}
          {ticks.map((v) => (
            <text
              key={`yl${v}`}
              x={padL - 4}
              y={yAt(v) + 3}
              fontSize={9}
              textAnchor="end"
              fill={GREEN}
              fillOpacity="0.7"
              fontFamily="var(--bento-mono), monospace"
            >
              {v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : v}
            </text>
          ))}

          {/* Baseline */}
          <line
            x1={padL}
            x2={W - padR}
            y1={padT + plotH}
            y2={padT + plotH}
            stroke={GREEN}
            strokeOpacity="0.25"
            strokeWidth={1}
          />

          {/* Hover crosshair */}
          {hoverIdx != null && (
            <line
              x1={padL + hoverIdx * dayW + dayW / 2}
              x2={padL + hoverIdx * dayW + dayW / 2}
              y1={padT}
              y2={padT + plotH}
              stroke={GREEN}
              strokeOpacity={0.7}
              strokeWidth={1}
              strokeDasharray="2 2"
              style={{ pointerEvents: "none" }}
            />
          )}

          {days.map((d, i) => {
            const cx = padL + i * dayW + dayW / 2;
            const x = cx - barW / 2;
            const y = d.steps > 0 ? yAt(d.steps) : padT + plotH;
            const h = d.steps > 0 ? padT + plotH - y : 0;
            const isHover = hoverIdx === i;
            const isBig = isHover || d.isToday;
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
                  <>
                    {/* Bar */}
                    <rect
                      x={r(x)}
                      y={r(y)}
                      width={r(barW)}
                      height={r(h)}
                      fill="url(#steps-bar)"
                      stroke={GREEN}
                      strokeOpacity={isBig ? "0.7" : "0.45"}
                      strokeWidth={1}
                      rx={1.5}
                    />
                    {/* Glowing top cap */}
                    <rect
                      x={r(x)}
                      y={r(y)}
                      width={r(barW)}
                      height={2}
                      fill={GREEN}
                      style={{
                        filter: `drop-shadow(0 0 ${isBig ? 5 : 3}px ${GREEN}) drop-shadow(0 0 ${isBig ? 10 : 6}px ${GREEN}aa)`,
                      }}
                    />
                  </>
                )}
                {d.isToday && (
                  <rect
                    x={r(x - 1)}
                    y={padT}
                    width={r(barW + 2)}
                    height={plotH}
                    fill="none"
                    stroke={GREEN}
                    strokeWidth={1}
                    strokeOpacity={0.55}
                    strokeDasharray="2 2"
                    rx={1.5}
                  />
                )}
                <text
                  x={r(cx)}
                  y={padT + plotH + 12}
                  fontSize={9}
                  textAnchor="middle"
                  fill={GREEN}
                  fillOpacity={isHover || d.isToday ? 1 : 0.5}
                  fontFamily="var(--bento-mono), monospace"
                  style={
                    isHover || d.isToday
                      ? { filter: `drop-shadow(0 0 3px ${GREEN})` }
                      : undefined
                  }
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hover && hover.steps > 0 && hoverIdx != null && (
        <div
          className={`absolute -top-2 -translate-y-full -translate-x-1/2 pointer-events-none z-20 ${spaceMono.className} px-2.5 py-1.5 rounded border text-[11px] tabular-nums whitespace-nowrap backdrop-blur-sm`}
          style={{
            left: `${((padL + (hoverIdx + 0.5) * dayW) / W) * 100}%`,
            borderColor: `${GREEN}77`,
            background: "rgba(0,0,0,0.88)",
            boxShadow: `0 0 12px ${GREEN}55`,
            color: "#ffffff",
          }}
        >
          <div
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{ color: GREEN, textShadow: `0 0 4px ${GREEN}88` }}
          >
            {hover.dateLabel}
          </div>
          <div className="font-bold">
            {hover.steps.toLocaleString("de-CH")}{" "}
            <span className="text-[#9ca3af] text-[10px]">Schritte</span>
          </div>
        </div>
      )}
    </div>
  );
}
