import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityBoosts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: activityId } = await params;

  const [activity] = await db
    .select({ id: activities.id, userId: activities.userId })
    .from(activities)
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (activity.userId === userId) {
    return NextResponse.json(
      { error: "Eigene Aktivität kann nicht geboostet werden" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select({ id: activityBoosts.id })
    .from(activityBoosts)
    .where(
      and(
        eq(activityBoosts.activityId, activityId),
        eq(activityBoosts.userId, userId),
      ),
    )
    .limit(1);

  let boosted: boolean;
  if (existing) {
    await db.delete(activityBoosts).where(eq(activityBoosts.id, existing.id));
    boosted = false;
  } else {
    await db.insert(activityBoosts).values({
      activityId,
      userId,
    });
    boosted = true;
  }

  const allBoosts = await db
    .select({ userId: activityBoosts.userId })
    .from(activityBoosts)
    .where(eq(activityBoosts.activityId, activityId));

  return NextResponse.json({
    boosted,
    count: allBoosts.length,
    userIds: allBoosts.map((b) => b.userId),
  });
}
