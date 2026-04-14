import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { GoalMetric, GoalTimeframe } from "@/lib/goals";

const VALID_METRICS: GoalMetric[] = ["distance", "duration", "ascent", "count"];
const VALID_TIMEFRAMES: GoalTimeframe[] = ["week", "month", "year"];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(goals)
    .where(eq(goals.userId, session.user.id))
    .orderBy(desc(goals.createdAt));
  return NextResponse.json({ goals: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();

  const metric = body.metric as GoalMetric;
  const timeframe = body.timeframe as GoalTimeframe;
  if (!VALID_METRICS.includes(metric)) {
    return NextResponse.json({ error: "Ungültige Metrik" }, { status: 400 });
  }
  if (!VALID_TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ error: "Ungültiger Zeitraum" }, { status: 400 });
  }
  const target = Number(body.targetValue);
  if (!Number.isFinite(target) || target <= 0) {
    return NextResponse.json({ error: "Zielwert muss > 0 sein" }, { status: 400 });
  }
  const activityType =
    typeof body.activityType === "string" && body.activityType.trim()
      ? body.activityType.trim().toUpperCase()
      : null;
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

  const [row] = await db
    .insert(goals)
    .values({
      userId: session.user.id,
      title,
      metric,
      activityType,
      timeframe,
      targetValue: target,
    })
    .returning();

  return NextResponse.json({ goal: row });
}
