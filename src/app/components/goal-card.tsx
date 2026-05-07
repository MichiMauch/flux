"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  activityTypesLabel,
  defaultTitle,
  formatGoalValue,
  metricLabel,
  timeframeLabel,
  type GoalMetric,
  type GoalTimeframe,
  type GoalProgress,
} from "@/lib/goals";
import { EditGoalButton } from "./goal-form";
import { spaceMono } from "./bento/bento-fonts";

const NEON = "#FF6A00";
const NEON_GREEN = "#39FF14";
const NEON_BLUE = "#00D4FF";
const NEON_GOLD = "#FFD700";
const GOAL_COLORS = [NEON_GREEN, NEON_BLUE, NEON_GOLD];

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
  index?: number;
}

export function GoalCard({ goal, progress, compact, index = 0 }: GoalCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const title = goal.title ?? defaultTitle(goal);
  const typeLabel = activityTypesLabel(goal.activityType);

  const achieved = progress.progressPct >= 100;
  const delta = progress.deltaPct;
  const ahead = delta > 2;
  const behind = delta < -2;

  const pct = Math.min(100, Math.round(progress.progressPct));
  const elapsedCapped = Math.min(100, progress.elapsedPct);
  const color = GOAL_COLORS[index % GOAL_COLORS.length];

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
          <div
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.16em] text-[#a3a3a3] truncate mb-1`}
          >
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

      {/* Value + percent */}
      <div className="flex items-baseline justify-between tabular-nums">
        <div>
          <span
            className={`${spaceMono.className} text-base font-bold`}
            style={{ color }}
          >
            {formatGoalValue(goal.metric, progress.currentValue)}
          </span>
          <span
            className={`${spaceMono.className} text-xs text-[#9ca3af] ml-1`}
          >
            / {formatGoalValue(goal.metric, progress.targetValue)}
          </span>
        </div>
        <span
          className={`${spaceMono.className} text-xs font-bold text-[#9ca3af]`}
        >
          {pct}%
        </span>
      </div>

      {/* CRT-style progress bar */}
      <div
        className="relative h-5 rounded-sm overflow-hidden border border-[#2a2a2a]"
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

        {/* Leading edge */}
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

        {/* Current-time marker (dashed neon white) */}
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
            title="Wo du nach Plan sein solltest"
          />
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        {achieved ? (
          <span
            className={`inline-flex items-center gap-1 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
            style={{ color, textShadow: `0 0 6px ${color}` }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ziel erreicht
          </span>
        ) : ahead ? (
          <span
            className={`inline-flex items-center gap-1 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
            style={{ color: NEON_GREEN }}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {Math.round(delta)}% voraus
          </span>
        ) : behind ? (
          <span
            className={`inline-flex items-center gap-1 ${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em]`}
            style={{ color: NEON }}
          >
            <TrendingDown className="h-3.5 w-3.5" />
            {Math.abs(Math.round(delta))}% hinter Plan
          </span>
        ) : (
          <span
            className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af]`}
          >
            Im Plan
          </span>
        )}
        <span
          className={`${spaceMono.className} text-[10px] font-bold uppercase tracking-[0.14em] text-[#9ca3af] tabular-nums`}
        >
          {progress.daysRemaining} Tage
        </span>
      </div>
    </div>
  );
}
