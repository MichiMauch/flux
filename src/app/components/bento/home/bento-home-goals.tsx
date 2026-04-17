import Link from "next/link";
import { Target, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { defaultTitle, formatGoalValue, type Goal } from "@/lib/goals";
import { computeGoalProgress } from "@/lib/goals-server";
import { activityTypeLabel } from "@/lib/activity-types";
import { spaceMono } from "../bento-fonts";

const NEON = "#FF6A00";
const NEON_GREEN = "#39FF14";
const NEON_BLUE = "#00D4FF";
const NEON_GOLD = "#FFD700";

const GOAL_COLORS = [NEON_GREEN, NEON_BLUE, NEON_GOLD];

const MAX_GOALS = 3;

export async function BentoHomeGoals({ userId }: { userId: string }) {
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt));

  if (rows.length === 0) return null;

  const withProgress = await Promise.all(
    rows.map(async (g) => ({
      goal: g as Goal,
      progress: await computeGoalProgress(g as Goal),
    }))
  );

  withProgress.sort((a, b) => {
    const aBehind = a.progress.deltaPct < 0 ? 1 : 0;
    const bBehind = b.progress.deltaPct < 0 ? 1 : 0;
    if (aBehind !== bBehind) return bBehind - aBehind;
    return b.progress.progressPct - a.progress.progressPct;
  });

  const visible = withProgress.slice(0, MAX_GOALS);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-3">
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3]`}
        >
          <Target className="h-3 w-3" style={{ color: NEON }} /> Ziele
        </span>
        <Link
          href="/goals"
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] hover:underline`}
          style={{ color: NEON }}
        >
          Alle →
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {visible.map(({ goal, progress }, i) => {
          const title = goal.title ?? defaultTitle(goal);
          const typeLabel = goal.activityType
            ? activityTypeLabel(goal.activityType)
            : "Alle";
          const achieved = progress.progressPct >= 100;
          const pct = Math.min(100, Math.round(progress.progressPct));
          const elapsedCapped = Math.min(100, progress.elapsedPct);
          const color = GOAL_COLORS[i % GOAL_COLORS.length];
          return (
            <Link
              key={goal.id}
              href="/goals"
              className="block rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-2.5 hover:border-[#4a4a4a] transition-colors"
            >
              <div
                className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.12em] text-[#a3a3a3] truncate`}
              >
                {typeLabel}
              </div>
              <div
                className="text-sm font-bold text-white truncate mt-0.5"
                title={title}
              >
                {title}
              </div>
              <div className="flex items-baseline justify-between mt-2 tabular-nums">
                <span
                  className={`${spaceMono.className} text-sm font-bold`}
                  style={{ color }}
                >
                  {formatGoalValue(goal.metric, progress.currentValue)}
                </span>
                <span
                  className={`${spaceMono.className} text-[10px] text-[#9ca3af]`}
                >
                  {pct}%
                </span>
              </div>
              <div className="relative h-4 rounded-sm bg-[#0a0a0a] overflow-hidden mt-2 border border-[#2a2a2a]">
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    boxShadow: `0 0 12px ${color}, 0 0 24px ${color}aa, inset 0 0 6px ${color}66`,
                  }}
                />
                {!achieved && (
                  <div
                    className="absolute inset-y-0 w-[2px] bg-white"
                    style={{
                      left: `calc(${elapsedCapped}% - 1px)`,
                      boxShadow: "0 0 6px white",
                    }}
                  />
                )}
              </div>
              {achieved && (
                <div
                  className={`inline-flex items-center gap-1 mt-1.5 ${spaceMono.className} text-[10px] font-bold`}
                  style={{ color, textShadow: `0 0 6px ${color}` }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Erreicht
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
