import Link from "next/link";
import { Trophy, Ruler, Mountain, Zap, Gauge } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";

type ActivityRow = {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distance: number | null;
  ascent: number | null;
  avgSpeed: number | null;
  trimp: number | null;
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
  });
}

function shortSport(type: string): string {
  const t = type.toUpperCase();
  if (t.includes("RUN") || t.includes("JOG")) return "Laufen";
  if (t.includes("CYCL") || t.includes("BIK") || t.includes("RIDE")) return "Rad";
  if (t.includes("HIK") || t.includes("TREK")) return "Wandern";
  if (t.includes("WALK")) return "Gehen";
  if (t.includes("SWIM")) return "Schwimmen";
  return "Sonst.";
}

function pickMax<K extends keyof ActivityRow>(
  rows: ActivityRow[],
  key: K
): ActivityRow | null {
  let best: ActivityRow | null = null;
  let bestVal = -Infinity;
  for (const r of rows) {
    const v = r[key] as number | null;
    if (v == null) continue;
    if (v > bestVal) {
      bestVal = v;
      best = r;
    }
  }
  return best;
}

export async function BentoDashboardRecords({ userId }: { userId: string }) {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);

  const rows = (await db
    .select({
      id: activities.id,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      distance: activities.distance,
      ascent: activities.ascent,
      avgSpeed: activities.avgSpeed,
      trimp: activities.trimp,
    })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), gte(activities.startTime, jan1))
    )) as ActivityRow[];

  const longest = pickMax(rows, "distance");
  const highest = pickMax(rows, "ascent");
  const fastest = pickMax(rows, "avgSpeed");
  const hardest = pickMax(rows, "trimp");

  const records: Array<{
    icon: React.ReactNode;
    label: string;
    row: ActivityRow | null;
    format: (r: ActivityRow) => string;
  }> = [
    {
      icon: <Ruler className="h-3 w-3" />,
      label: "Längste Distanz",
      row: longest,
      format: (r) => `${((r.distance ?? 0) / 1000).toFixed(1)} km`,
    },
    {
      icon: <Mountain className="h-3 w-3" />,
      label: "Meiste Höhenmeter",
      row: highest,
      format: (r) => `${Math.round(r.ascent ?? 0).toLocaleString("de-CH")} m`,
    },
    {
      icon: <Gauge className="h-3 w-3" />,
      label: "Höchste Ø-Speed",
      row: fastest,
      format: (r) => `${(((r.avgSpeed ?? 0) * 3.6)).toFixed(1)} km/h`,
    },
    {
      icon: <Zap className="h-3 w-3" />,
      label: "Höchster TRIMP",
      row: hardest,
      format: (r) => `${Math.round(r.trimp ?? 0)}`,
    },
  ];

  const hasAny = records.some((r) => r.row != null);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Trophy className="h-3 w-3" style={{ color: NEON }} />
          Rekorde · {now.getFullYear()}
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] tabular-nums`}
          style={{ color: NEON }}
        >
          YTD
        </span>
      </div>

      {!hasAny ? (
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#a3a3a3]`}
        >
          Noch keine Rekorde
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 gap-1.5 content-center">
          {records.map((rec, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-2"
            >
              <span style={{ color: NEON }}>{rec.icon}</span>
              <div className="min-w-0">
                <div
                  className={`${spaceMono.className} text-[9px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] truncate`}
                >
                  {rec.label}
                </div>
                {rec.row ? (
                  <Link
                    href={`/activity/${rec.row.id}`}
                    className={`${spaceMono.className} text-[10px] text-[#9ca3af] hover:text-white truncate block tabular-nums`}
                  >
                    {shortSport(rec.row.type)} · {fmtDate(rec.row.startTime)}
                  </Link>
                ) : (
                  <span
                    className={`${spaceMono.className} text-[10px] text-[#4a4a4a]`}
                  >
                    —
                  </span>
                )}
              </div>
              <span
                className={`${spaceMono.className} text-[13px] font-bold tabular-nums whitespace-nowrap`}
                style={{ color: rec.row ? NEON : "#4a4a4a" }}
              >
                {rec.row ? rec.format(rec.row) : "–"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
