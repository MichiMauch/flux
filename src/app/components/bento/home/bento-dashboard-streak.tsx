import { Flame } from "lucide-react";
import { db } from "@/lib/db";
import { activities, dailyActivity } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function currentStreak(activeDays: Set<string>): number {
  let d = new Date();
  // If today isn't active, start from yesterday (streak still alive for one "rest" night)
  if (!activeDays.has(dayKey(d))) {
    d.setDate(d.getDate() - 1);
    if (!activeDays.has(dayKey(d))) return 0;
  }
  let count = 0;
  while (activeDays.has(dayKey(d))) {
    count += 1;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function longestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = Array.from(activeDays)
    .map((k) => {
      const [y, m, dd] = k.split("-").map(Number);
      return new Date(y, m - 1, dd).getTime();
    })
    .sort((a, b) => a - b);
  const DAY = 24 * 3600 * 1000;
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === DAY) {
      cur += 1;
      if (cur > longest) longest = cur;
    } else if (sorted[i] !== sorted[i - 1]) {
      cur = 1;
    }
  }
  return longest;
}

export async function BentoDashboardStreak({ userId }: { userId: string }) {
  const [acts, daily] = await Promise.all([
    db
      .select({ startTime: activities.startTime })
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.startTime)),
    db
      .select({ date: dailyActivity.date, steps: dailyActivity.steps })
      .from(dailyActivity)
      .where(eq(dailyActivity.userId, userId)),
  ]);

  const activeDays = new Set<string>();
  for (const a of acts) activeDays.add(dayKey(a.startTime));
  for (const d of daily) if ((d.steps ?? 0) >= 5000) activeDays.add(d.date);

  const current = currentStreak(activeDays);
  const longest = longestStreak(activeDays);

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3 h-full flex flex-col">
      <div className="flex items-center mb-2">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Flame className="h-3 w-3" style={{ color: NEON }} />
          Streak
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-baseline gap-1.5" style={{ fontSize: "48px" }}>
          <SevenSegDisplay value={String(current)} />
          <span
            className={`${spaceMono.className} text-[0.32em] font-bold lowercase`}
            style={{ color: NEON }}
          >
            tage
          </span>
        </div>
      </div>
      <div
        className={`${spaceMono.className} text-[9px] uppercase tracking-[0.12em] text-[#a3a3a3] tabular-nums text-center`}
      >
        Rekord: <span className="text-white font-bold">{longest} Tage</span>
      </div>
    </div>
  );
}
