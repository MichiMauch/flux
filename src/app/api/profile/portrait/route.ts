import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PORTRAITS_PATH, getPortraitPath } from "@/lib/portraits";
import { assertValidImageBuffer, InvalidImageError } from "@/lib/image-validation";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu gross (max 10 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Validate by content (magic bytes via sharp), not by client-supplied MIME.
  try {
    await assertValidImageBuffer(buffer);
  } catch (e) {
    if (e instanceof InvalidImageError) {
      return NextResponse.json({ error: "Nur Bilddateien erlaubt" }, { status: 400 });
    }
    throw e;
  }

  const optimized = await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: "cover", position: "attention" })
    .webp({ quality: 85 })
    .toBuffer();

  await mkdir(PORTRAITS_PATH, { recursive: true });
  const filePath = getPortraitPath(session.user.id);
  await writeFile(filePath, optimized);

  // Save relative reference in users.image so we know a portrait exists.
  await db
    .update(users)
    .set({ image: `/api/profile/portrait/${session.user.id}` })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filePath = getPortraitPath(session.user.id);
  await unlink(filePath).catch(() => {});
  await db
    .update(users)
    .set({ image: null })
    .where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
