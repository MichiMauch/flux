/**
 * Videos einer Aktivität: Upload in Stücken und Liste.
 *
 * Der Upload kommt stückweise (VIDEO_CHUNK_BYTES), weil eine einzelne Anfrage
 * an zwei Grenzen stösst: Next lehnt Bodies über 10 MB ab, und Cloudflare vor
 * flux.mauch.rocks solche über 100 MB. Jedes Stück ist ein eigener POST mit
 * den rohen Bytes als Body:
 *
 *   POST ?uploadId=<uuid>&index=<n>&total=<anzahl>&size=<bytes>&name=<datei>
 *
 * Das letzte Stück schliesst den Upload ab: Zeile anlegen, Umwandlung im
 * Hintergrund starten. Der Client fragt den Stand danach per GET ab.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { appendFile, mkdir, stat, unlink, writeFile } from "node:fs/promises";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityVideos, users } from "@/lib/db/schema";
import {
  VIDEO_CHUNK_BYTES,
  VIDEO_MAX_BYTES,
  getVideoDir,
  videoPaths,
} from "@/lib/videos";
import { processUploadedVideo } from "@/lib/video-jobs";

export const runtime = "nodejs";
// Das Umwandeln läuft nach der Antwort weiter; so lange muss die Laufzeit
// bestehen bleiben.
export const maxDuration = 900;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return bad("Unauthorized", 401);
  const { id: activityId } = await params;

  const [activity] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, session.user.id)))
    .limit(1);
  if (!activity) return bad("Not found", 404);

  const q = request.nextUrl.searchParams;
  const uploadId = q.get("uploadId") ?? "";
  const index = Number(q.get("index"));
  const total = Number(q.get("total"));
  const size = Number(q.get("size"));
  const name = (q.get("name") ?? "").slice(0, 200) || null;

  if (!UUID.test(uploadId)) return bad("uploadId ungültig");
  if (!Number.isInteger(size) || size <= 0) return bad("size ungültig");
  if (size > VIDEO_MAX_BYTES) {
    return bad(`Video zu gross (max ${Math.round(VIDEO_MAX_BYTES / 1e6)} MB)`);
  }
  if (total !== Math.ceil(size / VIDEO_CHUNK_BYTES)) return bad("total passt nicht zu size");
  if (!Number.isInteger(index) || index < 0 || index >= total) return bad("index ungültig");

  const chunk = Buffer.from(await request.arrayBuffer());
  const isLast = index === total - 1;
  const expected = isLast ? size - index * VIDEO_CHUNK_BYTES : VIDEO_CHUNK_BYTES;
  if (chunk.length !== expected) return bad("Stück hat die falsche Grösse");

  const dir = getVideoDir(session.user.id, activityId);
  await mkdir(dir, { recursive: true });
  const paths = videoPaths(dir, uploadId);

  if (index === 0) {
    await writeFile(paths.upload, chunk);
  } else {
    // Stücke müssen lückenlos in Reihenfolge kommen. Die Dateigrösse ist der
    // Zeuge: stimmt sie nicht, fehlt ein Stück oder es kam doppelt.
    const current = await stat(paths.upload).then((s) => s.size, () => -1);
    if (current !== index * VIDEO_CHUNK_BYTES) {
      return bad("Stück ausser der Reihe — Upload neu starten", 409);
    }
    await appendFile(paths.upload, chunk);
  }

  if (!isLast) return NextResponse.json({ received: index });

  try {
    await db.insert(activityVideos).values({
      id: uploadId,
      activityId,
      status: "processing",
      originalName: name,
    });
  } catch (e) {
    await unlink(paths.upload).catch(() => {});
    console.error("[videos POST] Zeile nicht angelegt:", e);
    return bad("Upload konnte nicht abgeschlossen werden", 500);
  }

  after(() => processUploadedVideo(uploadId, dir));
  return NextResponse.json({ id: uploadId, status: "processing" });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return bad("Unauthorized", 401);
  const { id: activityId } = await params;

  const [activity] = await db
    .select({ ownerId: activities.userId, ownerPartnerId: users.partnerId })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!activity) return bad("Not found", 404);
  if (
    activity.ownerId !== session.user.id &&
    activity.ownerPartnerId !== session.user.id
  ) {
    return bad("Forbidden", 403);
  }

  const videos = await db
    .select({
      id: activityVideos.id,
      status: activityVideos.status,
      durationSec: activityVideos.durationSec,
      width: activityVideos.width,
      height: activityVideos.height,
      storyStatus: activityVideos.storyStatus,
    })
    .from(activityVideos)
    .where(eq(activityVideos.activityId, activityId))
    .orderBy(asc(activityVideos.createdAt));
  return NextResponse.json(videos);
}
