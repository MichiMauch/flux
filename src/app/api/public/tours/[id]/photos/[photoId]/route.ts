import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { db } from "@/lib/db";
import { activityPhotos, activityTourMembers, activityTours } from "@/lib/db/schema";
import { getTourStages } from "@/app/tours/data";
import { schluesselOk, tourFreigegeben } from "@/lib/public-tour-access";

// Fotos einer freigegebenen Tour für externe Websites, mit demselben Schlüssel
// wie /api/public/tours/<id>. `?thumb=1` liefert das 400er-Vorschaubild.

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  if (!schluesselOk(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id, photoId } = await params;
  if (!tourFreigegeben(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [photo] = await db
    .select({
      activityId: activityPhotos.activityId,
      filePath: activityPhotos.filePath,
      thumbnailPath: activityPhotos.thumbnailPath,
    })
    .from(activityPhotos)
    .where(eq(activityPhotos.id, photoId))
    .limit(1);
  if (!photo) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Gehört das Foto zur Tour? Direkt als Mitglied, oder als zusammengeführte
  // Aufzeichnung einer Etappe (zweite Person auf derselben Wanderung).
  const [member] = await db
    .select({ id: activityTourMembers.activityId })
    .from(activityTourMembers)
    .where(
      and(
        eq(activityTourMembers.tourId, id),
        eq(activityTourMembers.activityId, photo.activityId)
      )
    )
    .limit(1);
  let erlaubt = !!member;
  if (!erlaubt) {
    const [tour] = await db
      .select({ userId: activityTours.userId })
      .from(activityTours)
      .where(eq(activityTours.id, id))
      .limit(1);
    const stages = tour ? (await getTourStages(tour.userId, id, "manual"))?.stages ?? [] : [];
    erlaubt = stages.some((s) => s.recordingIds.includes(photo.activityId));
  }
  if (!erlaubt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const thumb = new URL(request.url).searchParams.get("thumb") === "1";
  const path = thumb ? photo.thumbnailPath : photo.filePath;
  try {
    let buffer: Buffer;
    try {
      buffer = await readFile(path);
    } catch {
      // Lokal liegen Prod-Pfade (/data/photos/...) unter ./data/photos/...
      if (!path.startsWith("/data/")) throw new Error("NOT_FOUND");
      buffer = await readFile("." + path);
    }
    const lower = path.toLowerCase();
    const contentType = lower.endsWith(".webp") ? "image/webp" : lower.endsWith(".png") ? "image/png" : "image/jpeg";
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }
}
