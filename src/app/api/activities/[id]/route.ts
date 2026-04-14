import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityPhotos,
  deletedPolarActivities,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Partial<typeof activities.$inferInsert> = {};
  const errors: string[] = [];

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) errors.push("Titel darf nicht leer sein.");
    else if (name.length > 200) errors.push("Titel zu lang (max 200).");
    else updates.name = name;
  }
  if (typeof body.type === "string" && body.type.trim()) {
    updates.type = body.type.trim();
  }
  if ("notes" in body) {
    if (body.notes == null || body.notes === "") {
      updates.notes = null;
    } else if (typeof body.notes === "string") {
      if (body.notes.length > 2000) errors.push("Notiz zu lang (max 2000).");
      else updates.notes = body.notes;
    }
  }
  for (const field of ["ascent", "descent"] as const) {
    if (field in body) {
      const v = body[field];
      if (v == null || v === "") {
        updates[field] = null;
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`${field === "ascent" ? "Aufstieg" : "Abstieg"} muss ≥ 0 sein.`);
        } else {
          updates[field] = n;
        }
      }
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await db
    .update(activities)
    .set(updates)
    .where(and(eq(activities.id, id), eq(activities.userId, session.user.id)))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ activity: result[0] });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const activity = await db.query.activities.findFirst({
      where: and(eq(activities.id, id), eq(activities.userId, session.user.id)),
    });
    if (!activity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const photos = await db
      .select({
        filePath: activityPhotos.filePath,
        thumbnailPath: activityPhotos.thumbnailPath,
      })
      .from(activityPhotos)
      .where(eq(activityPhotos.activityId, id));

    if (activity.polarId) {
      await db
        .insert(deletedPolarActivities)
        .values({ userId: session.user.id, polarId: activity.polarId })
        .onConflictDoNothing();
    }

    await db.delete(activities).where(eq(activities.id, id));

    await Promise.all(
      photos.flatMap((p) => [
        unlink(p.filePath).catch(() => {}),
        unlink(p.thumbnailPath).catch(() => {}),
      ])
    );
    if (activity.fitFilePath) {
      await unlink(activity.fitFilePath).catch(() => {});
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/activities/[id] failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Delete failed", details: message },
      { status: 500 }
    );
  }
}
