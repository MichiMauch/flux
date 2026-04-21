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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              <div
                className="relative h-4 rounded-sm overflow-hidden mt-2 border border-[#2a2a2a]"
                style={{
                  background:
                    "radial-gradient(ellipse at center, #0a0402 0%, #000 70%)",
                }}
              >
                {/* Scanlines */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-25"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 2px)",
                  }}
                />

                {/* Tick marks at 25/50/75% */}
                {[25, 50, 75].map((t) => (
                  <div
                    key={t}
                    aria-hidden
                    className="pointer-events-none absolute top-0 bottom-0 w-px"
                    style={{
                      left: `${t}%`,
                      background: color,
                      opacity: 0.15,
                    }}
                  />
                ))}

                {/* Halo layer */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: color,
                    opacity: 0.35,
                    filter: "blur(3px)",
                  }}
                />

                {/* Core fill */}
                <div
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}55, ${color})`,
                    boxShadow: `0 0 6px ${color}, inset 0 0 4px ${color}88`,
                  }}
                />

                {/* Leading edge — glowing marker at progress position.
                    Shown even at 0% so empty bars still have a visible
                    "start" indicator. */}
                {pct < 100 && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0"
                    style={{
                      left: `max(0px, calc(${pct}% - 1px))`,
                      width: "2px",
                      background: color,
                      boxShadow: `0 0 6px ${color}, 0 0 12px ${color}`,
                    }}
                  />
                )}

                {/* Current-time marker (dashed neon) */}
                {!achieved && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute top-0 bottom-0"
                    style={{
                      left: `calc(${elapsedCapped}% - 1px)`,
                      width: "2px",
                      background:
                        "repeating-linear-gradient(0deg, #ffffff 0px, #ffffff 2px, transparent 2px, transparent 4px)",
                      boxShadow: "0 0 4px #ffffff, 0 0 8px #ffffffaa",
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
