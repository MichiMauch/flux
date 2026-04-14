"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  defaultTitle,
  formatGoalValue,
  metricLabel,
  timeframeLabel,
  type GoalMetric,
  type GoalTimeframe,
  type GoalProgress,
} from "@/lib/goals";
import { activityTypeLabel } from "@/lib/activity-types";
import { EditGoalButton } from "./goal-form";

interface GoalCardProps {
  goal: {
    id: string;
    title: string | null;
    metric: GoalMetric;
    activityType: string | null;
    timeframe: GoalTimeframe;
    targetValue: number;
  };
  progress: GoalProgress;
  compact?: boolean;
}

export function GoalCard({ goal, progress, compact }: GoalCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const title = goal.title ?? defaultTitle(goal);
  const typeLabel = goal.activityType
    ? activityTypeLabel(goal.activityType)
    : "Alle Sportarten";

  const achieved = progress.progressPct >= 100;
  const delta = progress.deltaPct;
  const ahead = delta > 2;
  const behind = delta < -2;

  const progressCapped = Math.min(100, progress.progressPct);
  const elapsedCapped = Math.min(100, progress.elapsedPct);

  async function handleDelete() {
    if (!confirm(`Ziel „${title}" löschen?`)) return;
    setDeleting(true);
    await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground mb-0.5">
            {typeLabel} · {metricLabel(goal.metric)} · {timeframeLabel(goal.timeframe)}
          </div>
          <h3 className="font-bold text-base tracking-[-0.02em] truncate">
            {title}
          </h3>
        </div>
        {!compact && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <EditGoalButton goal={goal} />
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-surface disabled:opacity-40"
              aria-label="Löschen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar with elapsed marker */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between tabular-nums">
          <div className="text-base font-bold">
            {formatGoalValue(goal.metric, progress.currentValue)}
            <span className="text-muted-foreground text-xs ml-1 font-medium">
              / {formatGoalValue(goal.metric, progress.targetValue)}
            </span>
          </div>
          <div className="text-xs font-semibold">
            {Math.round(progress.progressPct)}%
          </div>
        </div>
        <div className="relative h-2 rounded-full bg-surface overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-brand transition-all"
            style={{ width: `${progressCapped}%` }}
          />
          {!achieved && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground/50"
              style={{ left: `calc(${elapsedCapped}% - 1px)` }}
              title="Wo du nach Plan sein solltest"
            />
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-xs">
        {achieved ? (
          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ziel erreicht
          </span>
        ) : ahead ? (
          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
            <TrendingUp className="h-3.5 w-3.5" />
            {Math.round(delta)}% voraus
          </span>
        ) : behind ? (
          <span className="inline-flex items-center gap-1 text-brand-dark font-semibold">
            <TrendingDown className="h-3.5 w-3.5" />
            {Math.abs(Math.round(delta))}% hinter Plan
          </span>
        ) : (
          <span className="text-muted-foreground">Im Plan</span>
        )}
        <span className="text-muted-foreground font-mono">
          {progress.daysRemaining} Tage
        </span>
      </div>
    </div>
  );
}
