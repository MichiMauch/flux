import { BarChart3 } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";
const NEON_BLUE = "#00D4FF";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

export async function BentoDashboardMonthlyChart({ userId }: { userId: string }) {
  const now = new Date();
  const year = now.getFullYear();
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);

  const rows = await db
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
    );

  const byMonth: { km: number; count: number }[] = Array.from(
    { length: 12 },
    () => ({ km: 0, count: 0 })
  );
  for (const a of rows) {
    const m = a.startTime.getMonth();
    byMonth[m].count += 1;
    byMonth[m].km += (a.distance ?? 0) / 1000;
  }

  const maxKm = Math.max(...byMonth.map((m) => m.km), 1);
  const maxCount = Math.max(...byMonth.map((m) => m.count), 1);

  const currentMonth = now.getMonth();
  const totalKm = byMonth.reduce((s, m) => s + m.km, 0);
  const totalCount = byMonth.reduce((s, m) => s + m.count, 0);

  const W = 720;
  const H = 200;
  const padL = 44;
  const padR = 48; // right padding for second axis
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const monthW = plotW / 12;
  const barW = monthW * 0.32;
  const gap = monthW * 0.08;

  const r = (n: number) => Math.round(n * 100) / 100;
  const kmY = (v: number) => padT + plotH - (v / maxKm) * plotH;
  const countY = (v: number) => padT + plotH - (v / maxCount) * plotH;

  // y ticks for km
  const kmStep = maxKm > 500 ? 250 : maxKm > 200 ? 100 : maxKm > 50 ? 25 : 10;
  const kmTicks: number[] = [];
  for (let v = kmStep; v <= maxKm; v += kmStep) kmTicks.push(v);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <BarChart3 className="h-3 w-3" style={{ color: NEON }} />
          Monat · {year}
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
            style={{ color: NEON }}
          >
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: NEON, boxShadow: `0 0 6px ${NEON}` }}
            />
            {Math.round(totalKm).toLocaleString("de-CH")} km
          </span>
          <span
            className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
            style={{ color: NEON_BLUE }}
          >
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ background: NEON_BLUE, boxShadow: `0 0 6px ${NEON_BLUE}` }}
            />
            {totalCount} Aktiv.
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="km-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={NEON} />
              <stop offset="100%" stopColor={NEON} stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="count-bar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={NEON_BLUE} />
              <stop offset="100%" stopColor={NEON_BLUE} stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* Y grid + km labels */}
          {kmTicks.map((v) => (
            <g key={`y${v}`}>
              <line
                x1={padL}
                x2={W - padR}
                y1={kmY(v)}
                y2={kmY(v)}
                stroke="#3a3a3a"
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <text
                x={padL - 6}
                y={kmY(v) + 3}
                fontSize={10}
                textAnchor="end"
                fill="#a3a3a3"
                fontFamily="var(--bento-mono), monospace"
              >
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />
          <line x1={padL} x2={padL} y1={padT} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />
          <line x1={W - padR} x2={W - padR} y1={padT} y2={padT + plotH} stroke="#4a4a4a" strokeWidth={1} />

          {/* Y-axis right: count ticks */}
          {(() => {
            const step = maxCount > 30 ? 10 : maxCount > 10 ? 5 : maxCount > 5 ? 2 : 1;
            const ticks: number[] = [];
            for (let v = step; v <= maxCount; v += step) ticks.push(v);
            return ticks.map((v) => (
              <text
                key={`cnt${v}`}
                x={W - padR + 6}
                y={countY(v) + 3}
                fontSize={10}
                textAnchor="start"
                fill="#a3a3a3"
                fontFamily="var(--bento-mono), monospace"
              >
                {v}
              </text>
            ));
          })()}

          {/* Bars */}
          {byMonth.map((m, i) => {
            const cx = padL + i * monthW + monthW / 2;
            const xKm = cx - barW - gap / 2;
            const xCt = cx + gap / 2;
            const isCurrent = i === currentMonth;
            const kmH = m.km > 0 ? plotH - (kmY(m.km) - padT) : 0;
            const ctH = m.count > 0 ? plotH - (countY(m.count) - padT) : 0;
            return (
              <g key={i}>
                {/* Current month faint highlight */}
                {isCurrent && (
                  <rect
                    x={cx - monthW / 2 + 2}
                    y={padT}
                    width={monthW - 4}
                    height={plotH}
                    fill={NEON}
                    fillOpacity={0.04}
                  />
                )}
                {m.km > 0 && (
                  <rect
                    x={r(xKm)}
                    y={r(kmY(m.km))}
                    width={r(barW)}
                    height={r(kmH)}
                    fill="url(#km-bar)"
                    rx={1.5}
                    style={{ filter: `drop-shadow(0 0 4px ${NEON}66)` }}
                  />
                )}
                {m.count > 0 && (
                  <rect
                    x={r(xCt)}
                    y={r(countY(m.count))}
                    width={r(barW)}
                    height={r(ctH)}
                    fill="url(#count-bar)"
                    rx={1.5}
                    style={{ filter: `drop-shadow(0 0 4px ${NEON_BLUE}66)` }}
                  />
                )}
                {/* Month label */}
                <text
                  x={r(cx)}
                  y={padT + plotH + 14}
                  fontSize={10}
                  textAnchor="middle"
                  fill={isCurrent ? "#ffffff" : "#a3a3a3"}
                  fontFamily="var(--bento-mono), monospace"
                  fontWeight={isCurrent ? 700 : 400}
                >
                  {MONTHS_SHORT[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
