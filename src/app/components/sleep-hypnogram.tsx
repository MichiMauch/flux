"use client";

import { useRef, useState } from "react";
import { spaceMono } from "./bento/bento-fonts";
import { SevenSegDisplay } from "./bento/seven-seg";

interface SleepHypnogramProps {
  hypnogram: unknown;
  sleepStart?: Date | null;
  sleepEnd?: Date | null;
}

const STAGE_ORDER = ["AWAKE", "REM", "LIGHT", "DEEP"] as const;
type StageKey = (typeof STAGE_ORDER)[number];

const STAGE_Y: Record<StageKey, number> = {
  AWAKE: 0,
  REM: 1,
  LIGHT: 2,
  DEEP: 3,
};

const STAGE_COLOR: Record<StageKey, string> = {
  AWAKE: "#f59e0b",
  REM: "#a855f7",
  LIGHT: "#60a5fa",
  DEEP: "#3b82f6",
};

const STAGE_LABEL: Record<StageKey, string> = {
  AWAKE: "WACH",
  REM: "REM",
  LIGHT: "LEICHT",
  DEEP: "TIEF",
};

const NEON = "#FF6A00";

// Polar hypnogram stage codes:
//   0 = WAKE, 1 = REM, 2 = N1 (light), 3 = N2 (light), 4 = N3 (deep)
function normalizeStage(v: unknown): StageKey | null {
  if (typeof v === "string") {
    const up = v.toUpperCase();
    if (up.includes("DEEP") || up === "N3") return "DEEP";
    if (up.includes("REM")) return "REM";
    if (up.includes("LIGHT") || up === "N1" || up === "N2") return "LIGHT";
    if (up.includes("WAKE") || up.includes("AWAKE")) return "AWAKE";
  }
  if (typeof v === "number") {
    if (v === 0) return "AWAKE";
    if (v === 1) return "REM";
    if (v === 2 || v === 3) return "LIGHT";
    if (v === 4) return "DEEP";
  }
  return null;
}

function parseClockAnchored(hhmm: string, anchor: Date): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hhmm);
  if (!m) {
    const t = Date.parse(hhmm);
    return Number.isFinite(t) ? t : null;
  }
  const h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] ? Number(m[3]) : 0;
  const d = new Date(anchor);
  d.setHours(h, mm, ss, 0);
  return d.getTime();
}

function extractPoints(
  hypnogram: unknown,
  sleepStart: Date | null | undefined
): { t: number; stage: StageKey }[] {
  const out: { t: number; stage: StageKey }[] = [];
  if (!hypnogram) return out;

  const anchor = sleepStart ?? new Date();

  if (Array.isArray(hypnogram)) {
    for (const e of hypnogram) {
      if (!e || typeof e !== "object") continue;
      const obj = e as Record<string, unknown>;
      const timeStr =
        (obj.time as string) ??
        (obj.timestamp as string) ??
        (obj.start as string) ??
        null;
      const stageRaw =
        obj.stage ??
        obj["sleep-stage"] ??
        obj.sleep_stage ??
        obj.state ??
        null;
      const stage = normalizeStage(stageRaw);
      if (!timeStr || !stage) continue;
      const t = parseClockAnchored(timeStr, anchor);
      if (t != null) out.push({ t, stage });
    }
  } else if (typeof hypnogram === "object") {
    const entries = Object.entries(hypnogram as Record<string, unknown>);
    let prev = -Infinity;
    let dayShift = 0;
    for (const [k, v] of entries) {
      const stage = normalizeStage(v);
      const base = parseClockAnchored(k, anchor);
      if (!stage || base == null) continue;
      let t = base + dayShift * 86400_000;
      if (t < prev) {
        dayShift++;
        t = base + dayShift * 86400_000;
      }
      prev = t;
      out.push({ t, stage });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

export function SleepHypnogram({
  hypnogram,
  sleepStart,
  sleepEnd,
}: SleepHypnogramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const points = extractPoints(hypnogram, sleepStart ?? null);
  if (points.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-black/40 p-6 text-center text-sm text-[#9ca3af]">
        Keine Hypnogram-Daten verfügbar.
      </div>
    );
  }

  const t0 = sleepStart?.getTime() ?? points[0].t;
  const t1 =
    sleepEnd?.getTime() ??
    points[points.length - 1].t ??
    t0 + 8 * 3600_000;
  const span = Math.max(t1 - t0, 1);

  const W = 1000;
  const H = 220;
  const pL = 70;
  const pR = 16;
  const pT = 16;
  const pB = 28;
  const plotW = W - pL - pR;
  const plotH = H - pT - pB;
  const laneH = plotH / 4;

  const xFor = (t: number) => pL + ((t - t0) / span) * plotW;
  const yFor = (stage: StageKey) =>
    pT + STAGE_Y[stage] * laneH + laneH / 2;

  type Seg = {
    x1: number;
    x2: number;
    t1: number;
    t2: number;
    stage: StageKey;
  };
  const segs: Seg[] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const next = points[i + 1];
    const segEnd = next ? next.t : t1;
    segs.push({
      x1: xFor(cur.t),
      x2: xFor(segEnd),
      t1: cur.t,
      t2: segEnd,
      stage: cur.stage,
    });
  }

  // Per-stage duration for stats
  const stageSec: Record<StageKey, number> = {
    AWAKE: 0,
    REM: 0,
    LIGHT: 0,
    DEEP: 0,
  };
  for (const s of segs) {
    stageSec[s.stage] += Math.max(0, s.t2 - s.t1) / 1000;
  }
  const totalSec = Object.values(stageSec).reduce((a, b) => a + b, 0) || 1;

  // Hour markers
  const hours: number[] = [];
  const hStart = new Date(t0);
  hStart.setMinutes(0, 0, 0);
  for (let t = hStart.getTime(); t <= t1; t += 3600_000) {
    if (t >= t0) hours.push(t);
  }

  // Minor 15-min markers
  const quarters: number[] = [];
  const qStart = new Date(t0);
  qStart.setMinutes(Math.ceil(qStart.getMinutes() / 15) * 15, 0, 0);
  for (let t = qStart.getTime(); t <= t1; t += 900_000) {
    if (t >= t0) quarters.push(t);
  }

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < pL || svgX > W - pR) {
      setHoverT(null);
      return;
    }
    const t = t0 + ((svgX - pL) / plotW) * span;
    setHoverT(t);
  };

  const hoverSeg =
    hoverT != null ? segs.find((s) => hoverT >= s.t1 && hoverT <= s.t2) : null;
  const hoverX = hoverT != null ? xFor(hoverT) : 0;

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-[#2a2a2a]"
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
            "repeating-linear-gradient(0deg, rgba(255,106,0,0.08) 0px, rgba(255,106,0,0.08) 1px, transparent 1px, transparent 3px)",
        }}
      />

      {/* Stage percentage tiles — separate strip above plot (WACH lane
          would otherwise draw under the tiles) */}
      <div className="relative z-10 flex justify-end gap-2 px-3 pt-3 pb-1">
        {STAGE_ORDER.map((s) => {
          const color = STAGE_COLOR[s];
          const pct = Math.round((stageSec[s] / totalSec) * 100);
          return (
            <div
              key={s}
              className="rounded border bg-black px-2 py-1 text-center"
              style={{ borderColor: `${color}55` }}
            >
              <div
                className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em]`}
                style={{ color, textShadow: `0 0 4px ${color}88` }}
              >
                {STAGE_LABEL[s]}
              </div>
              <div
                className="flex items-baseline justify-center gap-0.5"
                style={{ fontSize: "14px" }}
              >
                <SevenSegDisplay
                  value={String(pct)}
                  on={color}
                  off="#1a1a1a"
                />
                <span
                  className={`${spaceMono.className} text-[0.55em] font-bold`}
                  style={{ color }}
                >
                  %
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full h-56 cursor-crosshair"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverT(null)}
      >
        <defs>
          <filter id="hypGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Minor vertical grid (15-min) */}
        {quarters.map((t) => (
          <line
            key={`qv${t}`}
            x1={xFor(t)}
            x2={xFor(t)}
            y1={pT}
            y2={H - pB}
            stroke={NEON}
            strokeOpacity="0.05"
            strokeWidth={1}
          />
        ))}

        {/* Major vertical grid (hours) */}
        {hours.map((t) => (
          <line
            key={`hv${t}`}
            x1={xFor(t)}
            x2={xFor(t)}
            y1={pT}
            y2={H - pB}
            stroke={NEON}
            strokeOpacity="0.15"
            strokeWidth={1}
          />
        ))}

        {/* Stage lane reference lines + labels */}
        {STAGE_ORDER.map((s) => {
          const color = STAGE_COLOR[s];
          return (
            <g key={s}>
              <line
                x1={pL}
                x2={W - pR}
                y1={yFor(s)}
                y2={yFor(s)}
                stroke={color}
                strokeOpacity="0.1"
                strokeWidth={1}
                strokeDasharray="2 5"
              />
              <text
                x={pL - 8}
                y={yFor(s)}
                fill={color}
                fontSize="11"
                fontWeight="bold"
                textAnchor="end"
                dominantBaseline="middle"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.12em",
                  filter: `drop-shadow(0 0 4px ${color}88)`,
                }}
              >
                {STAGE_LABEL[s]}
              </text>
            </g>
          );
        })}

        {/* Vertical connectors between stage transitions */}
        {segs.slice(0, -1).map((cur, i) => {
          const next = segs[i + 1];
          const y1 = yFor(cur.stage);
          const y2 = yFor(next.stage);
          if (y1 === y2) return null;
          const grad = `url(#gradConn${i})`;
          return (
            <g key={`conn${i}`}>
              <defs>
                <linearGradient
                  id={`gradConn${i}`}
                  x1="0"
                  x2="0"
                  y1={y1}
                  y2={y2}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor={STAGE_COLOR[cur.stage]} />
                  <stop offset="100%" stopColor={STAGE_COLOR[next.stage]} />
                </linearGradient>
              </defs>
              <line
                x1={next.x1}
                x2={next.x1}
                y1={y1}
                y2={y2}
                stroke={grad}
                strokeWidth={1.5}
                strokeOpacity="0.6"
              />
            </g>
          );
        })}

        {/* Stage segments — halo + core */}
        {segs.map((s, i) => {
          const color = STAGE_COLOR[s.stage];
          const y = yFor(s.stage);
          return (
            <g key={`seg${i}`}>
              <line
                x1={s.x1}
                x2={s.x2}
                y1={y}
                y2={y}
                stroke={color}
                strokeOpacity="0.35"
                strokeWidth={10}
                strokeLinecap="round"
                filter="url(#hypGlow)"
              />
              <line
                x1={s.x1}
                x2={s.x2}
                y1={y}
                y2={y}
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 6px ${color}aa)`,
                }}
              />
            </g>
          );
        })}

        {/* X-axis hour labels */}
        {hours.map((t) => {
          const hh = new Date(t).getHours().toString().padStart(2, "0");
          return (
            <text
              key={`hl${t}`}
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

        {/* Hover crosshair */}
        {hoverSeg && (
          <g style={{ pointerEvents: "none" }}>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={pT}
              y2={H - pB}
              stroke={STAGE_COLOR[hoverSeg.stage]}
              strokeOpacity="0.8"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={hoverX}
              cy={yFor(hoverSeg.stage)}
              r={6}
              fill="none"
              stroke={STAGE_COLOR[hoverSeg.stage]}
              strokeWidth={1.5}
              style={{
                filter: `drop-shadow(0 0 4px ${STAGE_COLOR[hoverSeg.stage]}) drop-shadow(0 0 8px ${STAGE_COLOR[hoverSeg.stage]})`,
              }}
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverSeg && hoverT != null && (
        <div
          className="pointer-events-none absolute z-20"
          style={{
            left: `${(hoverX / W) * 100}%`,
            top: `${(yFor(hoverSeg.stage) / H) * 100}%`,
            transform: `translate(${hoverX > W / 2 ? "calc(-100% - 10px)" : "10px"}, -50%)`,
          }}
        >
          <div
            className="rounded border bg-black/85 px-2.5 py-1.5 backdrop-blur-sm"
            style={{ borderColor: `${STAGE_COLOR[hoverSeg.stage]}55` }}
          >
            <div
              className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ca3af]`}
            >
              {new Date(hoverT).toLocaleTimeString("de-CH", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div
              className={`${spaceMono.className} text-[11px] font-bold uppercase tracking-[0.18em]`}
              style={{
                color: STAGE_COLOR[hoverSeg.stage],
                textShadow: `0 0 4px ${STAGE_COLOR[hoverSeg.stage]}88`,
              }}
            >
              {STAGE_LABEL[hoverSeg.stage]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
