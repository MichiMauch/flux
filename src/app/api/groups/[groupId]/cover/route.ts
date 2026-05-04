import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activityGroups } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  GROUP_COVERS_PATH,
  getGroupCoverPath,
  getGroupCoverUrl,
} from "@/lib/group-covers";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function loadOwnedGroup(userId: string, groupId: string) {
  const rows = await db
    .select({
      id: activityGroups.id,
      coverPhotoPath: activityGroups.coverPhotoPath,
    })
    .from(activityGroups)
    .where(
      and(eq(activityGroups.id, groupId), eq(activityGroups.userId, userId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await params;
  const group = await loadOwnedGroup(session.user.id, groupId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!group.coverPhotoPath) {
    return NextResponse.json({ error: "No cover" }, { status: 404 });
  }

  try {
    const buf = await readFile(getGroupCoverPath(groupId));
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await params;
  const group = await loadOwnedGroup(session.user.id, groupId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Nur Bilddateien erlaubt" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei zu gross (max 10 MB)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(buffer)
    .rotate()
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .webp({ quality: 85 })
    .toBuffer();

  await mkdir(GROUP_COVERS_PATH, { recursive: true });
  await writeFile(getGroupCoverPath(groupId), optimized);

  await db
    .update(activityGroups)
    .set({
      coverPhotoPath: getGroupCoverUrl(groupId),
      updatedAt: new Date(),
    })
    .where(eq(activityGroups.id, groupId));

  return NextResponse.json({ ok: true, url: getGroupCoverUrl(groupId) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { groupId } = await params;
  const group = await loadOwnedGroup(session.user.id, groupId);
  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await unlink(getGroupCoverPath(groupId)).catch(() => {});
  await db
    .update(activityGroups)
    .set({ coverPhotoPath: null, updatedAt: new Date() })
    .where(eq(activityGroups.id, groupId));

  return NextResponse.json({ ok: true });
}
