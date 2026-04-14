import { startOfWeek, endOfWeek } from "./activity-week";

export type GoalMetric = "distance" | "duration" | "ascent" | "count";
export type GoalTimeframe = "week" | "month" | "year";

export interface Goal {
  id: string;
  userId: string;
  title: string | null;
  metric: GoalMetric;
  activityType: string | null;
  timeframe: GoalTimeframe;
  targetValue: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoalProgress {
  currentValue: number;
  targetValue: number;
  progressPct: number;
  elapsedPct: number;
  deltaPct: number;
  periodStart: Date;
  periodEnd: Date;
  daysRemaining: number;
  expectedPacePerDay: number;
}

export function getCurrentPeriod(
  timeframe: GoalTimeframe,
  now: Date = new Date()
): { start: Date; end: Date } {
  if (timeframe === "week") {
    return { start: startOfWeek(now), end: endOfWeek(now) };
  }
  if (timeframe === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  return { start, end };
}

export function metricUnit(metric: GoalMetric): string {
  switch (metric) {
    case "distance":
      return "km";
    case "duration":
      return "h";
    case "ascent":
      return "m";
    case "count":
      return "";
  }
}

export function metricLabel(metric: GoalMetric): string {
  switch (metric) {
    case "distance":
      return "Distanz";
    case "duration":
      return "Aktivitätszeit";
    case "ascent":
      return "Aufstieg";
    case "count":
      return "Aktivitäten";
  }
}

export function timeframeLabel(tf: GoalTimeframe): string {
  return tf === "week" ? "pro Woche" : tf === "month" ? "pro Monat" : "pro Jahr";
}

export function formatGoalValue(metric: GoalMetric, value: number): string {
  if (metric === "distance") {
    return `${Math.round(value * 10) / 10} km`;
  }
  if (metric === "duration") {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    if (h === 0) return `${m} min`;
    return `${h} h ${m.toString().padStart(2, "0")} min`;
  }
  if (metric === "ascent") {
    return `${Math.round(value).toLocaleString("de-CH")} m`;
  }
  return Math.round(value).toString();
}

export function defaultTitle(goal: {
  metric: GoalMetric;
  activityType: string | null;
  timeframe: GoalTimeframe;
  targetValue: number;
}): string {
  const type = goal.activityType ?? "Alle Sportarten";
  const formatted = formatGoalValue(goal.metric, goal.targetValue);
  return `${type} · ${formatted} ${timeframeLabel(goal.timeframe)}`;
}
