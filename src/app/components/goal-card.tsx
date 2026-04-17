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
    <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a3a3a3] mb-0.5">
            {typeLabel} · {metricLabel(goal.metric)} · {timeframeLabel(goal.timeframe)}
          </div>
          <h3 className="font-bold text-base tracking-[-0.02em] truncate text-white">
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
              className="p-1.5 rounded-md text-[#d0c5ba] hover:text-red-400 hover:bg-black/40 disabled:opacity-60"
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
          <div className="text-base font-bold text-white">
            {formatGoalValue(goal.metric, progress.currentValue)}
            <span className="text-[#9ca3af] text-xs ml-1 font-medium">
              / {formatGoalValue(goal.metric, progress.targetValue)}
            </span>
          </div>
          <div className="text-xs font-semibold text-white">
            {Math.round(progress.progressPct)}%
          </div>
        </div>
        <div className="relative h-2 rounded-full bg-black/60 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[#FF6A00] transition-all"
            style={{ width: `${progressCapped}%` }}
          />
          {!achieved && (
            <div
              className="absolute inset-y-0 w-0.5 bg-white/50"
              style={{ left: `calc(${elapsedCapped}% - 1px)` }}
              title="Wo du nach Plan sein solltest"
            />
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-xs">
        {achieved ? (
          <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ziel erreicht
          </span>
        ) : ahead ? (
          <span className="inline-flex items-center gap-1 text-green-400 font-semibold">
            <TrendingUp className="h-3.5 w-3.5" />
            {Math.round(delta)}% voraus
          </span>
        ) : behind ? (
          <span className="inline-flex items-center gap-1 text-[#FF6A00] font-semibold">
            <TrendingDown className="h-3.5 w-3.5" />
            {Math.abs(Math.round(delta))}% hinter Plan
          </span>
        ) : (
          <span className="text-[#9ca3af]">Im Plan</span>
        )}
        <span className="text-[#9ca3af] font-mono">
          {progress.daysRemaining} Tage
        </span>
      </div>
    </div>
  );
}
