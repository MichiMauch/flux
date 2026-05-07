import Link from "next/link";
import { Target, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  activityTypesLabel,
  defaultTitle,
  formatGoalValue,
  type Goal,
} from "@/lib/goals";
import { computeGoalProgress } from "@/lib/goals-server";

const MAX_GOALS = 3;

export async function GoalsSummary({ userId }: { userId: string }) {
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

  // Sort: behind plan first, then by progress desc
  withProgress.sort((a, b) => {
    const aBehind = a.progress.deltaPct < 0 ? 1 : 0;
    const bBehind = b.progress.deltaPct < 0 ? 1 : 0;
    if (aBehind !== bBehind) return bBehind - aBehind;
    return b.progress.progressPct - a.progress.progressPct;
  });

  const visible = withProgress.slice(0, MAX_GOALS);

  return (
    <div className="rounded-lg border border-border bg-surface/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <Target className="h-3 w-3" /> Ziele
        </span>
        <Link
          href="/goals"
          className="text-[11px] font-semibold text-brand hover:underline"
        >
          Alle ansehen →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {visible.map(({ goal, progress }) => {
          const title = goal.title ?? defaultTitle(goal);
          const typeLabel = activityTypesLabel(goal.activityType);
          const achieved = progress.progressPct >= 100;
          const delta = progress.deltaPct;
          const pct = Math.min(100, Math.round(progress.progressPct));
          const elapsedCapped = Math.min(100, progress.elapsedPct);
          return (
            <Link
              key={goal.id}
              href="/goals"
              className="block rounded-md bg-background border border-border p-2.5 hover:bg-surface transition-colors"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate">
                {typeLabel}
              </div>
              <div className="text-sm font-bold truncate mt-0.5" title={title}>
                {title}
              </div>
              <div className="flex items-baseline justify-between mt-2 tabular-nums">
                <span className="text-sm font-semibold">
                  {formatGoalValue(goal.metric, progress.currentValue)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface overflow-hidden mt-1">
                <div
                  className="absolute inset-y-0 left-0 bg-brand"
                  style={{ width: `${pct}%` }}
                />
                {!achieved && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-foreground/40"
                    style={{ left: `calc(${elapsedCapped}% - 1px)` }}
                  />
                )}
              </div>
              <div className="mt-1.5 text-[11px] font-semibold flex items-center gap-1">
                {achieved ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Erreicht
                  </span>
                ) : delta > 2 ? (
                  <span className="inline-flex items-center gap-1 text-green-700">
                    <TrendingUp className="h-3 w-3" />
                    {Math.round(delta)}% voraus
                  </span>
                ) : delta < -2 ? (
                  <span className="inline-flex items-center gap-1 text-brand-dark">
                    <TrendingDown className="h-3 w-3" />
                    {Math.abs(Math.round(delta))}% hinter Plan
                  </span>
                ) : (
                  <span className="text-muted-foreground">Im Plan</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
