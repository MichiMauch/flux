"use client";

import { useRef, useState } from "react";
import { spaceMono } from "./bento/bento-fonts";
import { SevenSegDisplay } from "./bento/seven-seg";

interface SleepHrChartProps {
  samples: unknown;
  sleepStart?: Date | null;
}

function parseClock(hhmm: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function extract(
  samples: unknown,
  sleepStart: Date | null | undefined
): { bpm: number; t: number }[] {
  if (!samples) return [];
  const out: { bpm: number; t: number }[] = [];
  const anchor = sleepStart ?? new Date();

  if (Array.isArray(samples)) {
    for (const s of samples) {
      if (!s || typeof s !== "object") continue;
      const obj = s as Record<string, unknown>;
      const tStr =
        (obj.time as string) ??
        (obj.timestamp as string) ??
        (obj.sample_time as string) ??
        null;
      const bpm =
        typeof obj.bpm === "number"
          ? obj.bpm
          : typeof obj["heart-rate"] === "number"
            ? (obj["heart-rate"] as number)
            : typeof obj.heart_rate === "number"
              ? (obj.heart_rate as number)
              : null;
      if (tStr && typeof bpm === "number" && Number.isFinite(bpm)) {
        const d = new Date(tStr);
        if (!Number.isNaN(d.getTime())) {
          out.push({ bpm, t: d.getTime() });
        }
      }
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  if (typeof samples === "object") {
    const entries = Object.entries(samples as Record<string, unknown>);
    let prev = -Infinity;
    let dayShift = 0;
    for (const [k, v] of entries) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const parsed = parseClock(k);
      if (!parsed) continue;
      const d = new Date(anchor);
      d.setHours(parsed.h, parsed.m, 0, 0);
      let t = d.getTime() + dayShift * 86400_000;
      if (t < prev) {
        dayShift++;
        t = d.getTime() + dayShift * 86400_000;
      }
      prev = t;
      out.push({ bpm: v, t });
    }
    out.sort((a, b) => a.t - b.t);
  }
  return out;
}

const NEON = "#FF6A00";

export function SleepHrChart({ samples, sleepStart }: SleepHrChartProps) {
  const data = extract(samples, sleepStart ?? null);
  if (data.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-black/40 p-6 text-center text-sm text-[#9ca3af]">
        Keine HR-Samples verfügbar.
      </div>
    );
  }

  const bpms = data.map((d) => d.bpm);
  const minBpm = Math.min(...bpms);
  const maxBpm = Math.max(...bpms);
  const avgBpm = bpms.reduce((s, b) => s + b, 0) / bpms.length;

  // Y-axis: pad to nearest 5 bpm
  const yMin = Math.floor((minBpm - 3) / 5) * 5;
  const yMax = Math.ceil((maxBpm + 3) / 5) * 5;

  const t0 = data[0].t;
  const t1 = data[data.length - 1].t;

  const W = 1000;
  const H = 260;
  const pL = 44;
  const pR = 16;
  const pT = 14;
  const pB = 26;
  const plotW = W - pL - pR;
  const plotH = H - pT - pB;

  const xFor = (t: number) => pL + ((t - t0) / (t1 - t0)) * plotW;
  const yFor = (bpm: number) =>
    pT + (1 - (bpm - yMin) / (yMax - yMin)) * plotH;

  const points = data.map((d) => `${xFor(d.t)},${yFor(d.bpm)}`).join(" ");

  // Major gridlines: every hour X, every 10 bpm Y
  const hours: number[] = [];
  const hStart = new Date(t0);
  hStart.setMinutes(0, 0, 0);
  for (let t = hStart.getTime(); t <= t1; t += 3600_000) {
    if (t >= t0) hours.push(t);
  }

  // Minor gridlines: every 15min X, every 5 bpm Y
  const quarters: number[] = [];
  const qStart = new Date(t0);
  qStart.setMinutes(Math.ceil(qStart.getMinutes() / 15) * 15, 0, 0);
  for (let t = qStart.getTime(); t <= t1; t += 900_000) {
    if (t >= t0) quarters.push(t);
  }

  const majorY: number[] = [];
  for (let b = Math.ceil(yMin / 10) * 10; b <= yMax; b += 10) majorY.push(b);
  const minorY: number[] = [];
  for (let b = Math.ceil(yMin / 5) * 5; b <= yMax; b += 5) {
    if (b % 10 !== 0) minorY.push(b);
  }

  const last = data[data.length - 1];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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
    // Binary search nearest sample by x coord
    let lo = 0;
    let hi = data.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xFor(data[mid].t) < svgX) lo = mid + 1;
      else hi = mid;
    }
    let best = lo;
    if (lo > 0) {
      const dA = Math.abs(xFor(data[lo - 1].t) - svgX);
      const dB = Math.abs(xFor(data[lo].t) - svgX);
      if (dA < dB) best = lo - 1;
    }
    setHoverIdx(best);
  };

  const hover = hoverIdx != null ? data[hoverIdx] : null;

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
        {[
          { k: "MIN", v: Math.round(minBpm) },
          { k: "AVG", v: Math.round(avgBpm) },
          { k: "MAX", v: Math.round(maxBpm) },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded border border-[#FF6A0033] bg-black/60 px-2 py-1 text-center"
          >
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              {s.k}
            </div>
            <div style={{ fontSize: "16px" }}>
              <SevenSegDisplay
                value={String(s.v)}
                on={NEON}
                off="#1a1a1a"
              />
            </div>
          </div>
        ))}
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
          <linearGradient id="hrTraceFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={NEON} stopOpacity="0.35" />
            <stop offset="100%" stopColor={NEON} stopOpacity="0" />
          </linearGradient>
          <filter id="hrGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Minor grid */}
        {quarters.map((t) => (
          <line
            key={`mx${t}`}
            x1={xFor(t)}
            x2={xFor(t)}
            y1={pT}
            y2={H - pB}
            stroke={NEON}
            strokeOpacity="0.06"
            strokeWidth={1}
          />
        ))}
        {minorY.map((b) => (
          <line
            key={`my${b}`}
            x1={pL}
            x2={W - pR}
            y1={yFor(b)}
            y2={yFor(b)}
            stroke={NEON}
            strokeOpacity="0.06"
            strokeWidth={1}
          />
        ))}

        {/* Major grid */}
        {hours.map((t) => (
          <line
            key={`Mx${t}`}
            x1={xFor(t)}
            x2={xFor(t)}
            y1={pT}
            y2={H - pB}
            stroke={NEON}
            strokeOpacity="0.18"
            strokeWidth={1}
          />
        ))}
        {majorY.map((b) => (
          <line
            key={`My${b}`}
            x1={pL}
            x2={W - pR}
            y1={yFor(b)}
            y2={yFor(b)}
            stroke={NEON}
            strokeOpacity="0.18"
            strokeWidth={1}
          />
        ))}

        {/* Avg baseline */}
        <line
          x1={pL}
          x2={W - pR}
          y1={yFor(avgBpm)}
          y2={yFor(avgBpm)}
          stroke={NEON}
          strokeOpacity="0.55"
          strokeWidth={1}
          strokeDasharray="6 4"
        />

        {/* Y-axis labels */}
        {majorY.map((b) => (
          <text
            key={`yl${b}`}
            x={pL - 6}
            y={yFor(b)}
            fill={NEON}
            fillOpacity="0.7"
            fontSize="10"
            textAnchor="end"
            dominantBaseline="middle"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {b}
          </text>
        ))}

        {/* X-axis labels */}
        {hours.map((t) => {
          const hh = new Date(t).getHours().toString().padStart(2, "0");
          return (
            <text
              key={`xl${t}`}
              x={xFor(t)}
              y={H - pB + 14}
              fill={NEON}
              fillOpacity="0.7"
              fontSize="10"
              textAnchor="middle"
              style={{ fontFamily: "ui-monospace, monospace" }}
            >
              {hh}:00
            </text>
          );
        })}

        {/* Area fill under curve */}
        <path
          d={`M ${xFor(t0)} ${H - pB} L ${data
            .map((d) => `${xFor(d.t)} ${yFor(d.bpm)}`)
            .join(" L ")} L ${xFor(t1)} ${H - pB} Z`}
          fill="url(#hrTraceFill)"
        />

        {/* Trace: halo + core */}
        <polyline
          points={points}
          fill="none"
          stroke={NEON}
          strokeOpacity="0.35"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#hrGlow)"
        />
        <polyline
          points={points}
          fill="none"
          stroke={NEON}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: `drop-shadow(0 0 3px ${NEON}) drop-shadow(0 0 6px ${NEON}aa)`,
          }}
        />

        {/* Sweep dot at last sample */}
        <circle
          cx={xFor(last.t)}
          cy={yFor(last.bpm)}
          r={3.5}
          fill="#fff"
          style={{
            filter: `drop-shadow(0 0 4px ${NEON}) drop-shadow(0 0 8px ${NEON})`,
          }}
        />

        {/* Hover crosshair */}
        {hover && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={xFor(hover.t)}
              x2={xFor(hover.t)}
              y1={pT}
              y2={H - pB}
              stroke={NEON}
              strokeOpacity="0.7"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={xFor(hover.t)}
              cy={yFor(hover.bpm)}
              r={5}
              fill="none"
              stroke={NEON}
              strokeWidth={1.5}
              style={{
                filter: `drop-shadow(0 0 4px ${NEON}) drop-shadow(0 0 8px ${NEON})`,
              }}
            />
            <circle
              cx={xFor(hover.t)}
              cy={yFor(hover.bpm)}
              r={2}
              fill="#fff"
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip (DOM-overlay, positioned relative to plot area) */}
      {hover && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${(xFor(hover.t) / W) * 100}%`,
            top: `${(yFor(hover.bpm) / H) * 100}%`,
            transform: `translate(${xFor(hover.t) > W / 2 ? "calc(-100% - 10px)" : "10px"}, -50%)`,
          }}
        >
          <div className="rounded border border-[#FF6A0055] bg-black/85 px-2.5 py-1.5 backdrop-blur-sm">
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              {new Date(hover.t).toLocaleTimeString("de-CH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div className="flex items-baseline gap-1" style={{ fontSize: "18px" }}>
              <SevenSegDisplay
                value={String(Math.round(hover.bpm))}
                on={NEON}
                off="#1a1a1a"
              />
              <span
                className={`${spaceMono.className} text-[0.5em] font-bold lowercase`}
                style={{ color: NEON }}
              >
                bpm
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
