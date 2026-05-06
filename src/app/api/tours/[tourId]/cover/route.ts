import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import sharp from "sharp";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activityTours, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  TOUR_COVERS_PATH,
  getTourCoverPath,
  getTourCoverUrl,
} from "@/lib/tour-covers";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

async function loadOwnedTour(userId: string, tourId: string) {
  const rows = await db
    .select({
      id: activityTours.id,
      coverPhotoPath: activityTours.coverPhotoPath,
    })
    .from(activityTours)
    .where(
      and(eq(activityTours.id, tourId), eq(activityTours.userId, userId))
    )
    .limit(1);
  return rows[0] ?? null;
}

async function loadReadableTour(userId: string, tourId: string) {
  const rows = await db
    .select({
      id: activityTours.id,
      coverPhotoPath: activityTours.coverPhotoPath,
      ownerId: activityTours.userId,
      sharedWithPartner: activityTours.sharedWithPartner,
      ownerPartnerId: users.partnerId,
    })
    .from(activityTours)
    .innerJoin(users, eq(users.id, activityTours.userId))
    .where(eq(activityTours.id, tourId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.ownerId === userId) return r;
  if (r.sharedWithPartner && r.ownerPartnerId === userId) return r;
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tourId } = await params;
  const tour = await loadReadableTour(session.user.id, tourId);
  if (!tour) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!tour.coverPhotoPath) {
    return NextResponse.json({ error: "No cover" }, { status: 404 });
  }

  try {
    const buf = await readFile(getTourCoverPath(tourId));
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
  { params }: { params: Promise<{ tourId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tourId } = await params;
  const tour = await loadOwnedTour(session.user.id, tourId);
  if (!tour) {
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
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(2400, 2400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  await mkdir(TOUR_COVERS_PATH, { recursive: true });
  await writeFile(getTourCoverPath(tourId), optimized);

  await db
    .update(activityTours)
    .set({
      coverPhotoPath: getTourCoverUrl(tourId),
      coverOffsetX: 50,
      coverOffsetY: 50,
      updatedAt: new Date(),
    })
    .where(eq(activityTours.id, tourId));

  return NextResponse.json({ ok: true, url: getTourCoverUrl(tourId) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tourId } = await params;
  const tour = await loadOwnedTour(session.user.id, tourId);
  if (!tour) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await unlink(getTourCoverPath(tourId)).catch(() => {});
  await db
    .update(activityTours)
    .set({ coverPhotoPath: null, updatedAt: new Date() })
    .where(eq(activityTours.id, tourId));

  return NextResponse.json({ ok: true });
}
