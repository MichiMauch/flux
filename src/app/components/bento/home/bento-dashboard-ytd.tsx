import { Ruler, TrendingUp, TrendingDown } from "lucide-react";
import { db } from "@/lib/db";
import { activities, goals } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";
const TARGET = "#39FF14";

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

export async function BentoDashboardYtd({ userId }: { userId: string }) {
  const now = new Date();
  const from = new Date(now.getFullYear(), 0, 1);
  const to = new Date(now.getFullYear() + 1, 0, 1);

  const [acts, yearlyDistanceGoals] = await Promise.all([
    db
      .select({
        startTime: activities.startTime,
        distance: activities.distance,
      })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          gte(activities.startTime, from),
          lt(activities.startTime, to)
        )
      ),
    db
      .select({
        targetValue: goals.targetValue,
        activityType: goals.activityType,
      })
      .from(goals)
      .where(
        and(
          eq(goals.userId, userId),
          eq(goals.metric, "distance"),
          eq(goals.timeframe, "year"),
          eq(goals.active, true)
        )
      ),
  ]);

  // Prefer overall "Alle Sportarten" goal (activityType null); fallback to first yearly distance goal
  const targetKm =
    yearlyDistanceGoals.find((g) => g.activityType == null)?.targetValue ??
    yearlyDistanceGoals[0]?.targetValue ??
    null;

  // Aggregate km per day
  const DAYS = 366; // covers leap years
  const km: number[] = new Array(DAYS).fill(0);
  for (const a of acts) {
    const idx = dayOfYear(a.startTime);
    if (idx >= 0 && idx < DAYS) {
      km[idx] += (a.distance ?? 0) / 1000;
    }
  }
  // Cumulative
  const cum: number[] = new Array(DAYS).fill(0);
  let running = 0;
  for (let i = 0; i < DAYS; i++) {
    running += km[i];
    cum[i] = running;
  }

  const today = dayOfYear(now);
  const totalYearDays = Math.floor(
    (new Date(now.getFullYear(), 11, 31).getTime() - from.getTime()) / 86400000
  ) + 1;

  const currentKm = cum[today] ?? 0;
  const expectedKm = targetKm != null ? (targetKm * (today + 1)) / totalYearDays : null;
  const deltaKm = expectedKm != null ? currentKm - expectedKm : null;
  const projectedKm =
    today > 0 ? (currentKm * totalYearDays) / (today + 1) : currentKm;

  // Chart dimensions
  const W = 600;
  const H = 160;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxY = Math.max(currentKm, targetKm ?? 0, projectedKm) * 1.05;
  const yAt = (v: number) => padT + plotH - (v / Math.max(1, maxY)) * plotH;
  const xAt = (d: number) => padL + (d / (totalYearDays - 1)) * plotW;
  const r = (n: number) => Math.round(n * 100) / 100;

  // Build actual cumulative path up to today
  let line = "";
  let area = `M${r(xAt(0))},${r(padT + plotH)} `;
  for (let i = 0; i <= today; i++) {
    const x = xAt(i);
    const y = yAt(cum[i]);
    line += `${i === 0 ? "M" : "L"}${r(x)},${r(y)} `;
    area += `L${r(x)},${r(y)} `;
  }
  area += `L${r(xAt(today))},${r(padT + plotH)} Z`;

  // Target pace line (diagonal from 0,0 to today,target)
  const targetLineEnd =
    targetKm != null
      ? `M${r(xAt(0))},${r(yAt(0))} L${r(xAt(totalYearDays - 1))},${r(yAt(targetKm))}`
      : null;

  // Month ticks
  const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const monthTicks: { x: number; label: string }[] = [];
  for (let m = 0; m < 12; m++) {
    const d = new Date(now.getFullYear(), m, 1);
    monthTicks.push({ x: xAt(dayOfYear(d)), label: MONTHS[m] });
  }

  // Y ticks
  const yStep = maxY > 2000 ? 1000 : maxY > 500 ? 250 : maxY > 100 ? 50 : 20;
  const yTicks: number[] = [];
  for (let v = yStep; v <= maxY; v += yStep) yTicks.push(v);

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6b6b]`}
        >
          <Ruler className="h-3 w-3" style={{ color: NEON }} />
          Distanz {now.getFullYear()}
        </span>
        {targetKm != null && (
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
            style={{ color: TARGET }}
          >
            Ziel {Math.round(targetKm).toLocaleString("de-CH")} km
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-4 mb-3">
        <div className="flex items-baseline gap-2" style={{ fontSize: "40px" }}>
          <SevenSegDisplay value={currentKm.toFixed(1)} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            km
          </span>
        </div>
        {deltaKm != null && (
          <div
            className={`${spaceMono.className} inline-flex items-center gap-1 text-[11px] font-bold tabular-nums px-2 py-1 rounded`}
            style={{
              color: deltaKm >= 0 ? TARGET : "#FF6A00",
              background: deltaKm >= 0 ? `${TARGET}1a` : `${NEON}1a`,
              textShadow: `0 0 6px ${deltaKm >= 0 ? TARGET : NEON}88`,
            }}
          >
            {deltaKm >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {deltaKm >= 0 ? "+" : ""}
            {deltaKm.toFixed(1)} km
            <span className="text-[#6b6b6b] ml-1">vs. Plan</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[140px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ytd-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={NEON} stopOpacity="0.4" />
              <stop offset="100%" stopColor={NEON} stopOpacity="0" />
            </linearGradient>
            <filter id="ytd-glow">
              <feGaussianBlur stdDeviation="2" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y grid + labels */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={yAt(v)}
                y2={yAt(v)}
                stroke="#3a3a3a"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <text
                x={padL - 6}
                y={yAt(v) + 3}
                fontSize={10}
                textAnchor="end"
                fill="#6b6b6b"
                fontFamily="var(--bento-mono), monospace"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            </g>
          ))}

          {/* Month ticks on X */}
          {monthTicks.map((m, i) => (
            <g key={`m${i}`}>
              <line
                x1={m.x}
                x2={m.x}
                y1={padT}
                y2={padT + plotH}
                stroke="#252525"
                strokeWidth={1}
              />
              <text
                x={m.x}
                y={padT + plotH + 14}
                fontSize={9}
                textAnchor="middle"
                fill="#4a4a4a"
                fontFamily="var(--bento-mono), monospace"
              >
                {m.label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />
          <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />

          {/* Today marker */}
          <line
            x1={xAt(today)}
            x2={xAt(today)}
            y1={padT}
            y2={padT + plotH}
            stroke="#ffffff"
            strokeWidth={1}
            strokeOpacity={0.25}
            strokeDasharray="2 2"
          />

          {/* Target pace line */}
          {targetLineEnd && (
            <path
              d={targetLineEnd}
              fill="none"
              stroke={TARGET}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              style={{ filter: `drop-shadow(0 0 3px ${TARGET}66)` }}
            />
          )}

          {/* Actual area + line */}
          <path d={area} fill="url(#ytd-grad)" />
          <path
            d={line}
            fill="none"
            stroke={NEON}
            strokeWidth={2}
            filter="url(#ytd-glow)"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current dot */}
          <circle
            cx={xAt(today)}
            cy={yAt(currentKm)}
            r={4}
            fill={NEON}
            stroke="#ffffff"
            strokeWidth={1.5}
            style={{ filter: `drop-shadow(0 0 6px ${NEON})` }}
          />
        </svg>
      </div>

      <div
        className={`${spaceMono.className} text-[10px] uppercase tracking-[0.1em] text-[#6b6b6b] tabular-nums mt-2 flex items-center justify-between`}
      >
        <span>
          Hochrechnung:{" "}
          <span className="text-white font-bold">
            {projectedKm.toFixed(0)} km
          </span>
        </span>
        {targetKm != null && (
          <span>
            {Math.round((currentKm / targetKm) * 100)}% von Ziel
          </span>
        )}
      </div>
    </div>
  );
}
