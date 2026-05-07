import "server-only";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import {
  getCurrentPeriod,
  parseActivityTypes,
  type Goal,
  type GoalProgress,
} from "./goals";
import { expandActivityType } from "./activity-types";

export async function computeGoalProgress(
  goal: Goal,
  now: Date = new Date()
): Promise<GoalProgress> {
  const { start, end } = getCurrentPeriod(goal.timeframe, now);

  const conditions = [
    eq(activities.userId, goal.userId),
    gte(activities.startTime, start),
    lt(activities.startTime, end),
  ];
  const selectedTypes = parseActivityTypes(goal.activityType);
  if (selectedTypes.length > 0) {
    const expanded = Array.from(
      new Set(selectedTypes.flatMap((t) => expandActivityType(t)))
    );
    conditions.push(
      expanded.length === 1
        ? eq(activities.type, expanded[0])
        : inArray(activities.type, expanded)
    );
  }

  const rows = await db
    .select({
      distance: activities.distance,
      duration: activities.duration,
      movingTime: activities.movingTime,
      ascent: activities.ascent,
    })
    .from(activities)
    .where(and(...conditions));

  let currentValue = 0;
  for (const r of rows) {
    if (goal.metric === "distance") {
      currentValue += (r.distance ?? 0) / 1000;
    } else if (goal.metric === "duration") {
      const sec = r.movingTime ?? r.duration ?? 0;
      currentValue += sec / 3600;
    } else if (goal.metric === "ascent") {
      currentValue += r.ascent ?? 0;
    } else if (goal.metric === "count") {
      currentValue += 1;
    }
  }

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(
    0,
    Math.min(totalMs, now.getTime() - start.getTime())
  );
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const daysRemaining = Math.ceil(remainingMs / (24 * 3600 * 1000));

  const progressPct =
    goal.targetValue > 0 ? (currentValue / goal.targetValue) * 100 : 0;
  const elapsedPct = totalMs > 0 ? (elapsedMs / totalMs) * 100 : 0;
  const deltaPct = progressPct - elapsedPct;

  const remainingValue = Math.max(0, goal.targetValue - currentValue);
  const expectedPacePerDay =
    daysRemaining > 0 ? remainingValue / daysRemaining : 0;

  return {
    currentValue,
    targetValue: goal.targetValue,
    progressPct,
    elapsedPct,
    deltaPct,
    periodStart: start,
    periodEnd: end,
    daysRemaining,
    expectedPacePerDay,
  };
}
