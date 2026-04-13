import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import exifr from "exifr";
import {
  getPhotoDir,
  getPhotoFilename,
  getThumbnailFilename,
} from "@/lib/photos";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: activityId } = await params;

  // Verify activity belongs to user
  const activity = await db.query.activities.findFirst({
    where: and(
      eq(activities.id, activityId),
      eq(activities.userId, session.user.id)
    ),
  });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "No files" }, { status: 400 });
  }

  const dir = getPhotoDir(session.user.id, activityId);
  await mkdir(dir, { recursive: true });

  const uploaded = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const photoId = crypto.randomUUID();

    // Extract EXIF GPS + timestamp
    let lat: number | null = null;
    let lng: number | null = null;
    let takenAt: Date | null = null;
    try {
      const exif = await exifr.parse(buffer, { gps: true });
      if (exif?.latitude && exif?.longitude) {
        lat = exif.latitude;
        lng = exif.longitude;
      }
      if (exif?.DateTimeOriginal) {
        takenAt = new Date(exif.DateTimeOriginal);
      }
    } catch (e) {
      console.warn("EXIF parse failed:", e);
    }

    // Get image metadata + create thumbnail
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = getPhotoFilename(photoId, ext);
    const thumbFilename = getThumbnailFilename(photoId);

    const meta = await sharp(buffer).metadata();

    // Auto-rotate based on EXIF, save original
    const rotated = await sharp(buffer).rotate().toBuffer();
    await writeFile(join(dir, filename), rotated);

    // 200x200 thumbnail
    await sharp(buffer)
      .rotate()
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toFile(join(dir, thumbFilename));

    const filePath = join(dir, filename);
    const thumbnailPath = join(dir, thumbFilename);

    await db.insert(activityPhotos).values({
      id: photoId,
      activityId,
      filePath,
      thumbnailPath,
      lat,
      lng,
      takenAt,
      width: meta.width ?? null,
      height: meta.height ?? null,
    });

    uploaded.push({ id: photoId, lat, lng });
  }

  return NextResponse.json({ uploaded });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: activityId } = await params;

  const activity = await db.query.activities.findFirst({
    where: and(
      eq(activities.id, activityId),
      eq(activities.userId, session.user.id)
    ),
  });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const photos = await db
    .select()
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, activityId));

  return NextResponse.json(photos);
}
