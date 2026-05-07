import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { joinActivityTypes, type GoalMetric, type GoalTimeframe } from "@/lib/goals";
import { revalidateTag } from "next/cache";
import { homeCacheTag } from "@/lib/cache/home-stats";

const VALID_METRICS: GoalMetric[] = ["distance", "duration", "ascent", "count"];
const VALID_TIMEFRAMES: GoalTimeframe[] = ["week", "month", "year"];

/**
 * Accept either `activityTypes: string[]` (multi-select, current API)
 * or legacy `activityType: string` (single).
 * Returns CSV string for storage in `goals.activity_type`, or null = alle.
 */
function readActivityTypes(body: {
  activityTypes?: unknown;
  activityType?: unknown;
}): string | null {
  if (Array.isArray(body.activityTypes)) {
    const arr = body.activityTypes.filter(
      (t): t is string => typeof t === "string"
    );
    return joinActivityTypes(arr);
  }
  if (typeof body.activityType === "string" && body.activityType.trim()) {
    return joinActivityTypes([body.activityType]);
  }
  return null;
}

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
  const activityType = readActivityTypes(body);
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

  revalidateTag(homeCacheTag(session.user.id), "default");
  return NextResponse.json({ goal: row });
}
