import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityBoosts, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendPushToUser } from "@/lib/push";

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
    .select({
      id: activities.id,
      userId: activities.userId,
      name: activities.name,
    })
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

    // Notify the activity owner — only on insert, never on un-boost,
    // and respect partnerPushEnabled.
    try {
      const [booster] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const [owner] = await db
        .select({
          id: users.id,
          partnerPushEnabled: users.partnerPushEnabled,
        })
        .from(users)
        .where(eq(users.id, activity.userId))
        .limit(1);
      if (owner?.partnerPushEnabled) {
        const boosterName = booster?.name?.trim() || "Jemand";
        await sendPushToUser(owner.id, {
          title: `${boosterName} hat deine Aktivität geboostet`,
          body: `„${activity.name}" — Rakete an!`,
          url: `/activity/${activityId}`,
          tag: `boost-${activityId}`,
          kind: "boost",
        });
      }
    } catch (err) {
      console.error("[boost] notification failed:", err);
    }
  }

  const allBoosts = await db
    .select({
      userId: activityBoosts.userId,
      userName: users.name,
      userImage: users.image,
    })
    .from(activityBoosts)
    .innerJoin(users, eq(activityBoosts.userId, users.id))
    .where(eq(activityBoosts.activityId, activityId));

  return NextResponse.json({
    boosted,
    count: allBoosts.length,
    boosters: allBoosts.map((b) => ({
      id: b.userId,
      name: b.userName ?? "User",
      image: b.userImage,
    })),
  });
}
