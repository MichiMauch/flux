import { Ruler } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";
const EARTH_CIRCUMFERENCE_KM = 40075;

function ytdRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getFullYear(), 0, 1), to: now };
}

function lastYearSameRange(now: Date): { from: Date; to: Date } {
  const from = new Date(now.getFullYear() - 1, 0, 1);
  const to = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
  return { from, to };
}

async function sumDistance(userId: string, from: Date, to: Date): Promise<number> {
  const rows = await db
    .select({ distance: activities.distance })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );
  return rows.reduce((s, r) => s + (r.distance ?? 0), 0);
}

export async function BentoDashboardYtdDistance({ userId }: { userId: string }) {
  const now = new Date();
  const ytd = ytdRange(now);
  const lastYear = lastYearSameRange(now);

  const [metersYtd, metersLastYear] = await Promise.all([
    sumDistance(userId, ytd.from, ytd.to),
    sumDistance(userId, lastYear.from, lastYear.to),
  ]);

  const kmYtd = metersYtd / 1000;
  const kmLast = metersLastYear / 1000;
  const pctOfLast = kmLast > 0 ? (kmYtd / kmLast) * 100 : 0;
  const equatorPct = (kmYtd / EARTH_CIRCUMFERENCE_KM) * 100;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3 h-full flex flex-col">
      <div className="flex items-center mb-1">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Ruler className="h-3 w-3" style={{ color: NEON }} />
          Distanz · {now.getFullYear()}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1.5" style={{ fontSize: "44px" }}>
          <SevenSegDisplay value={Math.round(kmYtd).toLocaleString("de-CH").replace(/'/g, "'")} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            km
          </span>
        </div>
      </div>

      {kmLast > 0 && (
        <div className="relative h-1.5 rounded-sm bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden mt-1">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${Math.min(100, pctOfLast)}%`,
              background: `linear-gradient(90deg, ${NEON}cc, ${NEON})`,
              boxShadow: `0 0 6px ${NEON}, inset 0 0 3px ${NEON}66`,
            }}
          />
        </div>
      )}

      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3] tabular-nums mt-1 text-center`}
      >
        <span style={{ color: NEON }}>{equatorPct.toFixed(1)} %</span> um die Welt
      </div>
    </div>
  );
}
