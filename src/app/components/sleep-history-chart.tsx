"use client";

import { useRef, useState } from "react";
import { spaceMono } from "./bento/bento-fonts";
import { SevenSegDisplay } from "./bento/seven-seg";

interface SleepHistoryChartProps {
  data: {
    date: string;
    hours: number | null;
    score: number | null;
  }[];
}

const NEON = "#FF6A00";
const CYAN = "#00D4FF";
const HOURS_MAX = 12;
const SCORE_MAX = 100;

export function SleepHistoryChart({ data }: SleepHistoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-black/40 p-6 text-center text-sm text-[#9ca3af]">
        Keine Historie verfügbar.
      </div>
    );
  }

  const W = 1000;
  const H = 260;
  const pL = 36;
  const pR = 36;
  const pT = 14;
  const pB = 30;
  const plotW = W - pL - pR;
  const plotH = H - pT - pB;

  // One bar per entry, centered in its slot
  const slotW = plotW / data.length;
  const barW = Math.min(slotW * 0.6, 32);
  const cx = (i: number) => pL + slotW * (i + 0.5);

  const yHours = (h: number) => pT + (1 - h / HOURS_MAX) * plotH;
  const yScore = (s: number) => pT + (1 - s / SCORE_MAX) * plotH;

  const scorePoints = data
    .map((d, i) =>
      d.score != null ? `${cx(i)},${yScore(d.score)}` : null
    )
    .filter((p): p is string => p !== null)
    .join(" ");

  // Stats for top-right overlay
  const validScores = data
    .map((d) => d.score)
    .filter((s): s is number => s != null);
  const validHours = data
    .map((d) => d.hours)
    .filter((h): h is number => h != null);
  const avgScore =
    validScores.length > 0
      ? Math.round(
          validScores.reduce((s, v) => s + v, 0) / validScores.length
        )
      : null;
  const avgHours =
    validHours.length > 0
      ? validHours.reduce((s, v) => s + v, 0) / validHours.length
      : null;

  // Hourly grid values (major: 3h, minor: 1h)
  const majorHours = [0, 3, 6, 9, 12];
  const minorHours = [1, 2, 4, 5, 7, 8, 10, 11];
  // Score grid (right axis): major 25
  const majorScores = [0, 25, 50, 75, 100];

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < pL || svgX > W - pR) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.floor((svgX - pL) / slotW))
    );
    setHoverIdx(idx);
  };

  const hover = hoverIdx != null ? data[hoverIdx] : null;
  const hoverX = hoverIdx != null ? cx(hoverIdx) : 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[#2a2a2a]"
      style={{
        background:
          "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
      }}
    >
      {/* Scanline overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,106,0,0.08) 0px, rgba(255,106,0,0.08) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Stats overlay */}
      <div className="absolute right-3 top-3 z-10 flex gap-3">
        {avgScore != null && (
          <div className="rounded border border-[#FF6A0033] bg-black/60 px-2 py-1 text-center">
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              Ø SCORE
            </div>
            <div style={{ fontSize: "16px" }}>
              <SevenSegDisplay
                value={String(avgScore)}
                on={NEON}
                off="#1a1a1a"
              />
            </div>
          </div>
        )}
        {avgHours != null && (
          <div className="rounded border border-[#00D4FF33] bg-black/60 px-2 py-1 text-center">
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              Ø STUNDEN
            </div>
            <div style={{ fontSize: "16px" }}>
              <SevenSegDisplay
                value={avgHours.toFixed(1)}
                on={CYAN}
                off="#1a1a1a"
              />
            </div>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full h-64 cursor-crosshair"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="histBarFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.55" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0.05" />
          </linearGradient>
          <filter id="histGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Minor horizontal grid (hours 1,2,4,5,7,8,10,11) */}
        {minorHours.map((h) => (
          <line
            key={`mnh${h}`}
            x1={pL}
            x2={W - pR}
            y1={yHours(h)}
            y2={yHours(h)}
            stroke={NEON}
            strokeOpacity="0.06"
            strokeWidth={1}
          />
        ))}

        {/* Major horizontal grid */}
        {majorHours.map((h) => (
          <line
            key={`mjh${h}`}
            x1={pL}
            x2={W - pR}
            y1={yHours(h)}
            y2={yHours(h)}
            stroke={NEON}
            strokeOpacity="0.18"
            strokeWidth={1}
          />
        ))}

        {/* Vertical slot separators (minor) */}
        {data.map((_, i) =>
          i > 0 ? (
            <line
              key={`vs${i}`}
              x1={pL + slotW * i}
              x2={pL + slotW * i}
              y1={pT}
              y2={H - pB}
              stroke={NEON}
              strokeOpacity="0.05"
              strokeWidth={1}
            />
          ) : null
        )}

        {/* Y-axis labels (left: hours) */}
        {majorHours.map((h) => (
          <text
            key={`ylh${h}`}
            x={pL - 6}
            y={yHours(h)}
            fill={CYAN}
            fillOpacity="0.75"
            fontSize="10"
            textAnchor="end"
            dominantBaseline="middle"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {h}h
          </text>
        ))}

        {/* Y-axis labels (right: score) */}
        {majorScores.map((s) => (
          <text
            key={`yls${s}`}
            x={W - pR + 6}
            y={yScore(s)}
            fill={NEON}
            fillOpacity="0.7"
            fontSize="10"
            textAnchor="start"
            dominantBaseline="middle"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {s}
          </text>
        ))}

        {/* X-axis labels: date (DD.MM), every other slot if dense */}
        {data.map((d, i) => {
          if (data.length > 10 && i % 2 !== 0) return null;
          const [, m, dd] = d.date.split("-");
          return (
            <text
              key={`xl${i}`}
              x={cx(i)}
              y={H - pB + 14}
              fill={NEON}
              fillOpacity="0.7"
              fontSize="10"
              textAnchor="middle"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {dd}.{m}
            </text>
          );
        })}

        {/* Bars (hours) */}
        {data.map((d, i) => {
          const h = d.hours ?? 0;
          if (h <= 0) return null;
          const top = yHours(h);
          const bot = yHours(0);
          return (
            <g key={`bar${i}`}>
              <rect
                x={cx(i) - barW / 2}
                y={top}
                width={barW}
                height={bot - top}
                fill="url(#histBarFill)"
                stroke={CYAN}
                strokeOpacity="0.55"
                strokeWidth={1}
                rx={2}
              />
              <rect
                x={cx(i) - barW / 2}
                y={top}
                width={barW}
                height={2}
                fill={CYAN}
                style={{
                  filter: `drop-shadow(0 0 4px ${CYAN}) drop-shadow(0 0 8px ${CYAN}aa)`,
                }}
              />
            </g>
          );
        })}

        {/* Score trace: halo + core */}
        {scorePoints && (
          <>
            <polyline
              points={scorePoints}
              fill="none"
              stroke={NEON}
              strokeOpacity="0.35"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#histGlow)"
            />
            <polyline
              points={scorePoints}
              fill="none"
              stroke="#FFF3E6"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: `drop-shadow(0 0 3px ${NEON}) drop-shadow(0 0 6px ${NEON}aa)`,
              }}
            />
          </>
        )}

        {/* Score dots */}
        {data.map((d, i) =>
          d.score != null ? (
            <circle
              key={`dot${i}`}
              cx={cx(i)}
              cy={yScore(d.score)}
              r={3}
              fill="#fff"
              style={{
                filter: `drop-shadow(0 0 4px ${NEON}) drop-shadow(0 0 8px ${NEON})`,
              }}
            />
          ) : null
        )}

        {/* Hover crosshair */}
        {hover && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={pT}
              y2={H - pB}
              stroke={NEON}
              strokeOpacity="0.7"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {hover.score != null && (
              <circle
                cx={hoverX}
                cy={yScore(hover.score)}
                r={5}
                fill="none"
                stroke={NEON}
                strokeWidth={1.5}
                style={{
                  filter: `drop-shadow(0 0 4px ${NEON}) drop-shadow(0 0 8px ${NEON})`,
                }}
              />
            )}
            {hover.hours != null && hover.hours > 0 && (
              <rect
                x={hoverX - barW / 2 - 2}
                y={yHours(hover.hours) - 2}
                width={barW + 4}
                height={2}
                fill={CYAN}
                style={{
                  filter: `drop-shadow(0 0 4px ${CYAN}) drop-shadow(0 0 8px ${CYAN})`,
                }}
              />
            )}
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hover && hoverIdx != null && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${(hoverX / W) * 100}%`,
            top: "14px",
            transform: `translate(${hoverX > W / 2 ? "calc(-100% - 10px)" : "10px"}, 0)`,
          }}
        >
          <div className="rounded border border-[#FF6A0055] bg-black/85 px-2.5 py-1.5 backdrop-blur-sm">
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              {new Date(hover.date + "T00:00:00Z").toLocaleDateString(
                "de-CH",
                {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  timeZone: "UTC",
                }
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              {hover.hours != null && (
                <div className="flex items-baseline gap-0.5" style={{ fontSize: "16px" }}>
                  <SevenSegDisplay
                    value={hover.hours.toFixed(1)}
                    on={CYAN}
                    off="#1a1a1a"
                  />
                  <span
                    className={`${spaceMono.className} text-[0.5em] font-bold lowercase`}
                    style={{ color: CYAN }}
                  >
                    h
                  </span>
                </div>
              )}
              {hover.score != null && (
                <div className="flex items-baseline gap-0.5" style={{ fontSize: "16px" }}>
                  <SevenSegDisplay
                    value={String(hover.score)}
                    on={NEON}
                    off="#1a1a1a"
                  />
                  <span
                    className={`${spaceMono.className} text-[0.45em] font-bold uppercase tracking-[0.1em]`}
                    style={{ color: "#9ca3af" }}
                  >
                    SCR
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
