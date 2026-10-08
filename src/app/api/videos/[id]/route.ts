/**
 * Ein einzelnes Video ausliefern oder löschen.
 *
 *   GET            das MP4, mit Range-Unterstützung (Spulen, iOS-Wiedergabe)
 *   GET ?poster=1  das Vorschaubild
 *   GET ?story=1   das fertige Story-Video (nur Besitzer)
 *   GET ?meta=1    Stand von Umwandlung und Story-Rendering als JSON
 *   DELETE         Video samt Dateien entfernen (nur Besitzer)
 *
 * Zugriff wie bei den Fotos: Besitzer, Partner oder ein gültiger Share-Token
 * der Aktivität bzw. einer Tour, zu der sie gehört.
 */
import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  activities,
  activityTourMembers,
  activityTours,
  activityVideos,
  users,
} from "@/lib/db/schema";
import { localCandidates, videoPaths } from "@/lib/videos";

export const runtime = "nodejs";

type Access = "owner" | "viewer" | null;

async function loadVideo(id: string) {
  const [row] = await db
    .select({ video: activityVideos, ownerId: activities.userId })
    .from(activityVideos)
    .innerJoin(activities, eq(activityVideos.activityId, activities.id))
    .where(eq(activityVideos.id, id))
    .limit(1);
  return row ?? null;
}

async function accessFor(
  request: NextRequest,
  activityId: string,
  ownerId: string
): Promise<Access> {
  const shareToken = request.nextUrl.searchParams.get("share");
  if (shareToken) {
    const [direct] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.shareToken, shareToken)))
      .limit(1);
    if (direct) return "viewer";
    const [viaTour] = await db
      .select({ id: activityTours.id })
      .from(activityTours)
      .innerJoin(activityTourMembers, eq(activityTours.id, activityTourMembers.tourId))
      .where(
        and(
          eq(activityTourMembers.activityId, activityId),
          eq(activityTours.shareToken, shareToken)
        )
      )
      .limit(1);
    return viaTour ? "viewer" : null;
  }
  const session = await auth();
  if (!session?.user?.id) return null;
  if (ownerId === session.user.id) return "owner";
  const [me] = await db
    .select({ partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  return me?.partnerId === ownerId ? "viewer" : null;
}

async function resolveFile(path: string | null) {
  if (!path) return null;
  for (const candidate of localCandidates(path)) {
    try {
      const s = await stat(candidate);
      return { path: candidate, size: s.size };
    } catch {}
  }
  return null;
}

/** Datei streamen, auf Wunsch nur einen Byte-Bereich. */
function streamFile(
  file: { path: string; size: number },
  contentType: string,
  rangeHeader: string | null
): Response {
  const base = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  const match = rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    // "bytes=-500" meint die letzten 500 Bytes.
    const start = match[1] ? Number(match[1]) : Math.max(0, file.size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), file.size - 1) : file.size - 1;
    if (start > end || start >= file.size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${file.size}` },
      });
    }
    const body = Readable.toWeb(
      createReadStream(file.path, { start, end })
    ) as unknown as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${file.size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  const body = Readable.toWeb(createReadStream(file.path)) as unknown as ReadableStream;
  return new Response(body, {
    headers: { ...base, "Content-Length": String(file.size) },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await loadVideo(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await accessFor(request, row.video.activityId, row.ownerId);
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = request.nextUrl.searchParams;
  const { video } = row;

  if (q.get("meta") === "1") {
    return NextResponse.json({
      id: video.id,
      status: video.status,
      durationSec: video.durationSec,
      width: video.width,
      height: video.height,
      storyStatus: video.storyStatus,
    });
  }

  if (q.get("poster") === "1") {
    const file = await resolveFile(video.posterPath);
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
    return streamFile(file, "image/jpeg", null);
  }

  if (q.get("story") === "1") {
    if (access !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const file = video.storyStatus === "ready" ? await resolveFile(video.storyPath) : null;
    if (!file) return NextResponse.json({ error: "Story-Video nicht bereit" }, { status: 404 });
    return streamFile(file, "video/mp4", request.headers.get("range"));
  }

  const file = video.status === "ready" ? await resolveFile(video.filePath) : null;
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
  return streamFile(file, "video/mp4", request.headers.get("range"));
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await loadVideo(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (row.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(activityVideos).where(eq(activityVideos.id, id));

  // Dateien nach bestem Bemühen entfernen — auch Reste eines abgebrochenen
  // Uploads oder Renderings, die in der Zeile gar nicht stehen.
  const known = [row.video.filePath, row.video.posterPath, row.video.storyPath];
  const dir = row.video.filePath?.slice(0, row.video.filePath.lastIndexOf("/"));
  const derived = dir ? Object.values(videoPaths(dir, id)) : [];
  for (const path of new Set([...known, ...derived])) {
    if (!path) continue;
    for (const candidate of localCandidates(path)) {
      await unlink(candidate).catch(() => {});
    }
  }

  return NextResponse.json({ deleted: true });
}
