import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isThumb = request.nextUrl.searchParams.get("thumb") === "1";

  const photo = await db
    .select()
    .from(activityPhotos)
    .innerJoin(activities, eq(activityPhotos.activityId, activities.id))
    .where(eq(activityPhotos.id, id))
    .limit(1);

  if (photo.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify ownership — own activity OR partner's activity (read-only access)
  const activityOwnerId = photo[0].activities.userId;
  if (activityOwnerId !== session.user.id) {
    const [me] = await db
      .select({ partnerId: users.partnerId })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (!me?.partnerId || me.partnerId !== activityOwnerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const path = isThumb
    ? photo[0].activity_photos.thumbnailPath
    : photo[0].activity_photos.filePath;

  async function readWithFallback(p: string) {
    try {
      return await readFile(p);
    } catch {
      // Dev fallback: prod-style absolute paths (e.g. /data/photos/...)
      // don't exist locally when files live under ./data/photos/...
      if (p.startsWith("/data/")) {
        return await readFile("." + p);
      }
      throw new Error("NOT_FOUND");
    }
  }

  try {
    const buffer = await readWithFallback(path);
    const lower = path.toLowerCase();
    const contentType = lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const photo = await db
    .select()
    .from(activityPhotos)
    .innerJoin(activities, eq(activityPhotos.activityId, activities.id))
    .where(eq(activityPhotos.id, id))
    .limit(1);

  if (photo.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (photo[0].activities.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(activityPhotos).where(eq(activityPhotos.id, id));

  // Try to delete files (best effort)
  try {
    const { unlink } = await import("fs/promises");
    await unlink(photo[0].activity_photos.filePath).catch(() => {});
    await unlink(photo[0].activity_photos.thumbnailPath).catch(() => {});
  } catch {}

  return NextResponse.json({ deleted: true });
}
