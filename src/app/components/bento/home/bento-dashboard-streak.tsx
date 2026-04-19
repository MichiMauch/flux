import { Flame } from "lucide-react";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { spaceMono } from "../bento-fonts";
import { SevenSegDisplay } from "../seven-seg";

const NEON = "#FF6A00";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function prevDayKey(key: string): string {
  const [y, m, dd] = key.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

function currentStreak(activeDays: Set<string>): number {
  let key = dayKey(new Date());
  // Heute zählt noch nicht als Streak-Bruch — die Serie lebt bis Mitternacht weiter.
  if (!activeDays.has(key)) key = prevDayKey(key);
  let count = 0;
  while (activeDays.has(key)) {
    count += 1;
    key = prevDayKey(key);
  }
  return count;
}

function longestStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = Array.from(activeDays).sort();
  let longest = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1] === prevDayKey(sorted[i])) {
      cur += 1;
      if (cur > longest) longest = cur;
    } else {
      cur = 1;
    }
  }
  return longest;
}

export async function BentoDashboardStreak({ userId }: { userId: string }) {
  const acts = await db
    .select({ startTime: activities.startTime })
    .from(activities)
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.startTime));

  const activeDays = new Set<string>();
  for (const a of acts) activeDays.add(dayKey(a.startTime));

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
