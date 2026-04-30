import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityPhotos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import exifr from "exifr";
import * as piexif from "piexif-ts";
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

    // Extract EXIF GPS + timestamp. Three strategies layered, take the
    // first one that yields finite coordinates:
    // (1) exifr.parse(...).latitude/longitude (auto-translated decimal)
    // (2) exifr.gps(buffer) shortcut
    // (3) Manual DMS→decimal from raw GPSLatitude/GPSLongitude arrays.
    //     Some Samsung Galaxy S25 JPEGs (HDR + GainMap container) trip
    //     up exifr's auto-translate but the raw DMS tuples are there.
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

    function dmsToDecimal(
      dms: unknown,
      ref: unknown,
    ): number | null {
      if (!Array.isArray(dms) || dms.length < 1) return null;
      const d = typeof dms[0] === "number" ? dms[0] : Number(dms[0]);
      const m = typeof dms[1] === "number" ? dms[1] : Number(dms[1] ?? 0);
      const s = typeof dms[2] === "number" ? dms[2] : Number(dms[2] ?? 0);
      if (![d, m, s].every((v) => Number.isFinite(v))) return null;
      let decimal = d + m / 60 + s / 3600;
      const refStr =
        typeof ref === "string" ? ref.trim().toUpperCase() : "";
      if (refStr === "S" || refStr === "W") decimal = -decimal;
      if (!Number.isFinite(decimal)) return null;
      return decimal;
    }

    const dmsLat = dmsToDecimal(
      parsed?.GPSLatitude,
      parsed?.GPSLatitudeRef,
    );
    const dmsLng = dmsToDecimal(
      parsed?.GPSLongitude,
      parsed?.GPSLongitudeRef,
    );

    // Strategy 4: piexif-ts (independent JPEG EXIF parser, robust against
    // exifr-quirks like Samsung Galaxy S25 HDR/GainMap JPEGs).
    // We do the rational→decimal math ourselves because piexif's
    // GPSHelper.dmsRationalToDeg insists on a strict "N"/"S"/"E"/"W"
    // string match, and Samsung writes the ref with a trailing null byte
    // ("N\0") which trips the helper.
    function normalizeRef(raw: unknown): string {
      if (typeof raw !== "string") return "";
      // Strip control chars (incl. trailing \0 from EXIF Ascii type) and
      // whitespace, uppercase.
      // eslint-disable-next-line no-control-regex
      return raw.replace(/[^A-Za-z]/g, "").toUpperCase();
    }
    function rationalDmsToDecimal(
      dms: unknown,
      refRaw: unknown,
    ): number | null {
      if (!Array.isArray(dms) || dms.length < 3) return null;
      const parts = dms.map((tuple) => {
        if (
          !Array.isArray(tuple) ||
          tuple.length < 2 ||
          typeof tuple[0] !== "number" ||
          typeof tuple[1] !== "number" ||
          tuple[1] === 0
        ) {
          return NaN;
        }
        return tuple[0] / tuple[1];
      });
      const [d, m, s] = parts;
      if (![d, m, s].every((v) => Number.isFinite(v))) return null;
      let decimal = d + m / 60 + s / 3600;
      const ref = normalizeRef(refRaw);
      if (ref === "S" || ref === "W") decimal = -decimal;
      return Number.isFinite(decimal) ? decimal : null;
    }

    let piexifLat: number | null = null;
    let piexifLng: number | null = null;
    let piexifLatRefRaw: unknown = undefined;
    let piexifLngRefRaw: unknown = undefined;
    let rawDateTimeOriginal: unknown = undefined;
    let rawOffsetTimeOriginal: unknown = undefined;
    try {
      const binStr = buffer.toString("binary");
      const exifObj = piexif.load(binStr);
      const gps = exifObj.GPS;
      if (gps) {
        const latRaw = gps[piexif.TagValues.GPSIFD.GPSLatitude];
        const latRef = gps[piexif.TagValues.GPSIFD.GPSLatitudeRef];
        const lngRaw = gps[piexif.TagValues.GPSIFD.GPSLongitude];
        const lngRef = gps[piexif.TagValues.GPSIFD.GPSLongitudeRef];
        piexifLatRefRaw = latRef;
        piexifLngRefRaw = lngRef;
        piexifLat = rationalDmsToDecimal(latRaw, latRef);
        piexifLng = rationalDmsToDecimal(lngRaw, lngRef);
      }
      const exifSection = exifObj.Exif;
      if (exifSection) {
        rawDateTimeOriginal =
          exifSection[piexif.TagValues.ExifIFD.DateTimeOriginal];
        rawOffsetTimeOriginal =
          exifSection[piexif.TagValues.ExifIFD.OffsetTimeOriginal];
      }
    } catch (e) {
      console.warn(`[photos POST] ${file.name} — piexif failed:`, e);
    }

    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      lat = parsedLat as number;
      lng = parsedLng as number;
    } else if (Number.isFinite(gpsLat) && Number.isFinite(gpsLng)) {
      lat = gpsLat as number;
      lng = gpsLng as number;
    } else if (dmsLat != null && dmsLng != null) {
      lat = dmsLat;
      lng = dmsLng;
    } else if (piexifLat != null && piexifLng != null) {
      lat = piexifLat;
      lng = piexifLng;
    }

    // Reconstruct the photo's actual UTC timestamp from raw EXIF strings.
    // exifr's auto-conversion of DateTimeOriginal is unreliable when
    // OffsetTimeOriginal is present (server vs. browser disagree by the
    // offset amount). The raw EXIF format is always:
    //   DateTimeOriginal: "YYYY:MM:DD HH:MM:SS" (camera-local naive time)
    //   OffsetTimeOriginal: "+HH:MM" or "-HH:MM" (camera TZ at capture)
    // → assemble a real ISO-8601 string with the offset and let the JS
    //   Date constructor do the UTC math.
    function parseExifDateTimeUTC(
      dt: unknown,
      offset: unknown,
    ): Date | null {
      if (typeof dt !== "string") return null;
      const cleanDt = dt.replace(/[ \s]+$/, "");
      const m = cleanDt.match(
        /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      );
      if (!m) return null;
      const [, y, mo, d, h, mi, s] = m;
      let tz = "Z";
      if (typeof offset === "string") {
        const cleanOff = offset.replace(/[ \s]+$/, "");
        if (/^[+-]\d{2}:\d{2}$/.test(cleanOff)) tz = cleanOff;
      }
      const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${tz}`;
      const parsedDate = new Date(iso);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    let photoTakenAt: Date | null = parseExifDateTimeUTC(
      rawDateTimeOriginal,
      rawOffsetTimeOriginal,
    );
    // Fallback chain if raw piexif didn't have it
    if (photoTakenAt == null) {
      const dto2 = parsed?.DateTimeOriginal;
      if (dto2 instanceof Date) {
        photoTakenAt = dto2;
      } else if (typeof dto2 === "string") {
        const d = new Date(dto2);
        if (!Number.isNaN(d.getTime())) photoTakenAt = d;
      }
    }
    if (photoTakenAt == null) {
      const ovDto = exifOverrides[i]?.takenAt;
      if (typeof ovDto === "string") {
        const d = new Date(ovDto);
        if (!Number.isNaN(d.getTime())) photoTakenAt = d;
      }
    }

    // Strategy 5: route-point match. If the photo has no GPS in EXIF
    // (e.g. mobile browser stripped it) but we know when the photo was
    // taken AND the activity has a GPS track with timestamps — match
    // the photo's takenAt against the closest track point. This is
    // often more accurate than phone-EXIF-GPS during sport activities
    // anyway (sport-watch GPS is cleaner than phone-GPS while moving).
    let routeMatchLat: number | null = null;
    let routeMatchLng: number | null = null;
    let routeMatchDeltaSec: number | null = null;
    let routeDataLen = 0;
    let routeBestDeltaSec: number | null = null;
    if ((lat == null || lng == null) && photoTakenAt != null) {
      const routeData = activity.routeData as
        | Array<{ lat: number; lng: number; time?: string }>
        | null;
      const isArr = Array.isArray(routeData);
      routeDataLen = isArr ? (routeData as unknown[]).length : 0;
      console.info(
        `[photos POST] ${file.name} ROUTE_MATCH input: photoTakenAt=${photoTakenAt.toISOString()} ` +
          `routeData=${typeof routeData} isArray=${isArr} length=${routeDataLen}`,
      );
      if (isArr && routeData!.length > 0) {
        const photoMs = photoTakenAt.getTime();
        let bestDelta = Infinity;
        let bestPoint: { lat: number; lng: number; time?: string } | null = null;
        let skippedNoTime = 0;
        let skippedBadCoord = 0;
        for (const p of routeData!) {
          if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
            skippedBadCoord += 1;
            continue;
          }
          if (typeof p.time !== "string") {
            skippedNoTime += 1;
            continue;
          }
          const t = new Date(p.time).getTime();
          if (Number.isNaN(t)) continue;
          const delta = Math.abs(t - photoMs);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestPoint = p;
          }
        }
        if (Number.isFinite(bestDelta)) {
          routeBestDeltaSec = Math.round(bestDelta / 1000);
        }
        console.info(
          `[photos POST] ${file.name} ROUTE_MATCH scan: ` +
            `bestDelta=${routeBestDeltaSec}s skippedNoTime=${skippedNoTime} ` +
            `skippedBadCoord=${skippedBadCoord} bestPoint=${
              bestPoint
                ? `{lat:${bestPoint.lat},lng:${bestPoint.lng},time:${bestPoint.time}}`
                : "null"
            }`,
        );
        // With correct UTC parsing of DateTimeOriginal + OffsetTimeOriginal
        // the photo timestamp matches the GPS-track timestamp on the
        // second. A 5-minute tolerance still leaves room for camera-clock
        // drift but rejects photos that are clearly not from this activity.
        const TOLERANCE_MS = 5 * 60 * 1000;
        if (bestPoint && bestDelta <= TOLERANCE_MS) {
          routeMatchLat = bestPoint.lat;
          routeMatchLng = bestPoint.lng;
          routeMatchDeltaSec = Math.round(bestDelta / 1000);
          if (lat == null || lng == null) {
            lat = routeMatchLat;
            lng = routeMatchLng;
          }
        }
      }
    }

    if (photoTakenAt != null) takenAt = photoTakenAt;

    const refToString = (v: unknown) =>
      typeof v === "string"
        ? JSON.stringify(v)
        : v == null
          ? "null"
          : typeof v;
    console.info(
      `[photos POST] ${file.name} EXTRACTION: ` +
        `size=${file.size} ` +
        `parsedLat=${parsedLat} parsedLng=${parsedLng} ` +
        `gpsLat=${gpsLat} gpsLng=${gpsLng} ` +
        `dmsLat=${dmsLat} dmsLng=${dmsLng} ` +
        `piexifLat=${piexifLat} piexifLng=${piexifLng} ` +
        `piexifLatRef=${refToString(piexifLatRefRaw)} ` +
        `piexifLngRef=${refToString(piexifLngRefRaw)} ` +
        `rawDateTimeOriginal=${refToString(rawDateTimeOriginal)} ` +
        `rawOffsetTimeOriginal=${refToString(rawOffsetTimeOriginal)} ` +
        `photoTakenAt=${photoTakenAt?.toISOString() ?? "null"} ` +
        `routeMatchLat=${routeMatchLat} routeMatchLng=${routeMatchLng} ` +
        `routeMatchDeltaSec=${routeMatchDeltaSec} ` +
        `routeDataLen=${routeDataLen} routeBestDeltaSec=${routeBestDeltaSec} ` +
        `chosenLat=${lat} chosenLng=${lng}`,
    );
    if (lat == null && lng == null) {
      console.warn(
        `[photos POST] ${file.name} NO_GPS — file appears to have no readable GPS EXIF (mobile browser may have stripped metadata)`,
      );
    }

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

    uploaded.push({
      id: photoId,
      lat,
      lng,
      location,
      // Diagnostics — exposed in the upload response so the client can
      // surface "no GPS extracted" to the user without server-log access.
      diagnostics: {
        parsedLat: Number.isFinite(parsedLat) ? parsedLat : null,
        parsedLng: Number.isFinite(parsedLng) ? parsedLng : null,
        gpsLat: Number.isFinite(gpsLat) ? gpsLat : null,
        gpsLng: Number.isFinite(gpsLng) ? gpsLng : null,
        dmsLat,
        dmsLng,
        piexifLat,
        piexifLng,
        routeMatchLat,
        routeMatchLng,
        routeMatchDeltaSec,
        fileSize: file.size,
        fileType: file.type,
      },
    });
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
