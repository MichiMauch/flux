import { Mountain } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";
const MATTERHORN_M = 4478;
const EVEREST_M = 8848;

function ytdRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getFullYear(), 0, 1), to: now };
}

export async function BentoDashboardYtdAscent({ userId }: { userId: string }) {
  const now = new Date();
  const { from, to } = ytdRange(now);

  const rows = await db
    .select({ ascent: activities.ascent })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  const totalMeters = Math.round(rows.reduce((s, r) => s + (r.ascent ?? 0), 0));
  const mountain = totalMeters >= EVEREST_M
    ? { label: "Everest", m: EVEREST_M }
    : { label: "Matterhorn", m: MATTERHORN_M };
  const mountainCount = totalMeters / mountain.m;

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3 h-full flex flex-col">
      <div className="flex items-center mb-1">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Mountain className="h-3 w-3" style={{ color: NEON }} />
          Höhenmeter · {now.getFullYear()}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1.5" style={{ fontSize: "44px" }}>
          <SevenSegDisplay value={totalMeters.toLocaleString("de-CH")} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            m
          </span>
        </div>
      </div>

      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.1em] text-[#a3a3a3] tabular-nums mt-1 text-center`}
      >
        <span style={{ color: NEON }}>{mountainCount.toFixed(1)} ×</span> {mountain.label}
      </div>
    </div>
  );
}
