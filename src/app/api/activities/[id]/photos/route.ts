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
import { reverseGeocode } from "@/lib/geocode";

const MAX_PHOTO_SIZE = 20 * 1024 * 1024;
const MAX_PHOTOS_PER_REQUEST = 20;

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

  // Optional client-supplied EXIF overrides (preserved when files are
  // re-encoded client-side and would otherwise lose EXIF tags).
  type ExifOverride = {
    lat?: number | null;
    lng?: number | null;
    takenAt?: string | null;
  };
  const exifRaw = formData.get("exif");
  let exifOverrides: ExifOverride[] = [];
  if (typeof exifRaw === "string") {
    try {
      const parsed = JSON.parse(exifRaw);
      if (Array.isArray(parsed)) exifOverrides = parsed;
    } catch {
      // ignore malformed override
    }
  }
  if (files.length > MAX_PHOTOS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Max ${MAX_PHOTOS_PER_REQUEST} Fotos pro Upload` },
      { status: 400 }
    );
  }
  for (const f of files) {
    if (!f.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Nur Bilddateien erlaubt" },
        { status: 400 }
      );
    }
    if (f.size > MAX_PHOTO_SIZE) {
      return NextResponse.json(
        { error: "Datei zu gross (max 20 MB)" },
        { status: 400 }
      );
    }
  }

  const dir = getPhotoDir(session.user.id, activityId);
  await mkdir(dir, { recursive: true });

  const uploaded = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const buffer = Buffer.from(await file.arrayBuffer());
    const photoId = crypto.randomUUID();

    // Extract EXIF GPS + timestamp — try two strategies for robustness:
    // (1) full exifr.parse with gps:true returns flattened latitude/longitude
    // (2) exifr.gps() shortcut, sometimes more reliable across formats.
    let lat: number | null = null;
    let lng: number | null = null;
    let takenAt: Date | null = null;

    type LooseExif = Record<string, unknown> | null | undefined;
    let parsed: LooseExif = null;
    try {
      parsed = (await exifr.parse(buffer, { gps: true })) as LooseExif;
    } catch (e) {
      console.warn(`[photos POST] ${file.name} — exifr.parse failed:`, e);
    }

    let gpsOnly: { latitude?: unknown; longitude?: unknown } | null = null;
    try {
      const result = await exifr.gps(buffer);
      gpsOnly = result as { latitude?: unknown; longitude?: unknown } | null;
    } catch (e) {
      console.warn(`[photos POST] ${file.name} — exifr.gps failed:`, e);
    }

    const parsedLat = parsed?.latitude;
    const parsedLng = parsed?.longitude;
    const gpsLat = gpsOnly?.latitude;
    const gpsLng = gpsOnly?.longitude;

    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      lat = parsedLat as number;
      lng = parsedLng as number;
    } else if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
      lat = gpsLat as number;
      lng = gpsLng as number;
    }

    const dto = parsed?.DateTimeOriginal;
    if (dto instanceof Date) {
      takenAt = dto;
    } else if (typeof dto === "string") {
      const d = new Date(dto);
      if (!Number.isNaN(d.getTime())) takenAt = d;
    }

    console.info(
      `[photos POST] ${file.name} (${file.size}B, ${file.type}) — buffer EXIF`,
      {
        parsedLat,
        parsedLng,
        gpsLat,
        gpsLng,
        rawKeys: parsed ? Object.keys(parsed) : [],
      },
    );

    // Client-supplied overrides take precedence (image was re-encoded
    // and EXIF in the buffer is missing/incomplete). Only accept finite
    // numbers — NaN/Infinity would corrupt the DB and crash Leaflet.
    const override = exifOverrides[i];
    if (override) {
      console.info(
        `[photos POST] ${file.name} — client override:`,
        override,
      );
      if (Number.isFinite(override.lat)) lat = override.lat as number;
      if (Number.isFinite(override.lng)) lng = override.lng as number;
      if (typeof override.takenAt === "string") {
        const d = new Date(override.takenAt);
        if (!Number.isNaN(d.getTime())) takenAt = d;
      }
    }
    // Final safety net: never persist non-finite coordinates.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      lat = null;
      lng = null;
    }
    console.info(
      `[photos POST] ${file.name} — final lat=${lat} lng=${lng} takenAt=${takenAt?.toISOString() ?? null}`,
    );

    // Web-optimized: max 2048px longest side, WebP quality 82
    const filename = getPhotoFilename(photoId, "webp");
    const thumbFilename = getThumbnailFilename(photoId);

    const optimized = await sharp(buffer)
      .rotate() // EXIF auto-rotate
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    await writeFile(join(dir, filename), optimized.data);

    // 400x400 thumbnail
    await sharp(buffer)
      .rotate()
      .resize(400, 400, { fit: "cover" })
      .webp({ quality: 75, effort: 4 })
      .toFile(join(dir, thumbFilename));

    const meta = optimized.info;

    // Reverse geocode location name
    let location: string | null = null;
    if (lat != null && lng != null) {
      location = await reverseGeocode(lat, lng);
    }

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
      location,
      width: meta.width ?? null,
      height: meta.height ?? null,
    });

    uploaded.push({ id: photoId, lat, lng, location });
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
