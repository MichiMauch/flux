import { Moon } from "lucide-react";
import { db } from "@/lib/db";
import { sleepSessions } from "@/lib/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function BentoDashboardSleepAvg({ userId }: { userId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = shiftDate(today, -6);

  const rows = await db
    .select({
      date: sleepSessions.date,
      score: sleepSessions.sleepScore,
      totalSleepSec: sleepSessions.totalSleepSec,
    })
    .from(sleepSessions)
    .where(
      and(
        eq(sleepSessions.userId, userId),
        gte(sleepSessions.date, cutoff)
      )
    )
    .orderBy(desc(sleepSessions.date));

  const scored = rows.filter((r) => r.score != null);
  const avg =
    scored.length > 0
      ? scored.reduce((s, r) => s + (r.score as number), 0) / scored.length
      : null;

  const avgHours =
    rows.length > 0
      ? rows.reduce((s, r) => s + (r.totalSleepSec ?? 0), 0) /
        rows.length /
        3600
      : null;

  if (avg == null) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
        <div className="flex items-center gap-1.5 mb-3">
          <Moon className="h-3 w-3" style={{ color: NEON }} />
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
          >
            Schlaf Ø 7 Tage
          </span>
        </div>
        <div
          className={`flex-1 flex items-center justify-center ${spaceMono.className} text-xs text-[#a3a3a3]`}
        >
          Keine Daten
        </div>
      </div>
    );
  }

  const avgInt = Math.round(avg);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Moon className="h-3 w-3" style={{ color: NEON }} />
          Schlaf Ø 7 Tage
        </span>
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums`}
        >
          {scored.length} N
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-2" style={{ fontSize: "36px" }}>
          <SevenSegDisplay value={String(avgInt)} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            / 100
          </span>
        </div>
      </div>
      {avgHours != null && (
        <div
          className={`${spaceMono.className} text-[10px] text-[#a3a3a3] tabular-nums uppercase tracking-[0.1em] mt-1 text-center`}
        >
          Ø{" "}
          <span className="text-white font-bold">{avgHours.toFixed(1)}h</span>{" "}
          pro Nacht
        </div>
      )}
    </div>
  );
}
