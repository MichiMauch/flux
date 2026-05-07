import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { homeCacheTag } from "@/lib/cache/home-stats";
import { joinActivityTypes } from "@/lib/goals";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const updates: Partial<typeof goals.$inferInsert> = {};
  if (typeof body.title === "string") {
    updates.title = body.title.trim() || null;
  }
  if (typeof body.targetValue === "number" && body.targetValue > 0) {
    updates.targetValue = body.targetValue;
  }
  if (typeof body.active === "boolean") {
    updates.active = body.active;
  }
  if (Array.isArray(body.activityTypes)) {
    const arr = (body.activityTypes as unknown[]).filter(
      (t): t is string => typeof t === "string"
    );
    updates.activityType = joinActivityTypes(arr);
  } else if (body.activityType === null || typeof body.activityType === "string") {
    updates.activityType =
      typeof body.activityType === "string" && body.activityType.trim()
        ? joinActivityTypes([body.activityType])
        : null;
  }
  updates.updatedAt = new Date();

  const [row] = await db
    .update(goals)
    .set(updates)
    .where(and(eq(goals.id, id), eq(goals.userId, session.user.id)))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  revalidateTag(homeCacheTag(session.user.id), "default");
  return NextResponse.json({ goal: row });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, session.user.id)));
  revalidateTag(homeCacheTag(session.user.id), "default");
  return NextResponse.json({ deleted: true });
}
