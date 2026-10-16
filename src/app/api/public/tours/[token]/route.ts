import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, activityPhotos, activityTours } from "@/lib/db/schema";
import { getTourStages } from "@/app/tours/data";

// Öffentliche, schreibgeschützte Sicht auf eine geteilte Tour für externe
// Websites (z. B. Grenzgänger). Zugang nur über den Share-Token der Tour.
// Bewusst ohne Zeitstempel im Track, ohne Puls und ohne Foto-Koordinaten.
// Die Bilder selbst holt der Client über /api/photos/<id>?share=<token>.

export const dynamic = "force-dynamic";

const CACHE_HEADER = "public, s-maxage=300, stale-while-revalidate=600";

type Point = { lat?: unknown; lng?: unknown };

function toIso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function toTrack(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  const track: [number, number][] = [];
  for (const p of raw as Point[]) {
    if (
      p &&
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
    ) {
      track.push([round6(p.lng), round6(p.lat)]);
    }
  }
  return track;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const [tour] = token
    ? await db
        .select({
          id: activityTours.id,
          userId: activityTours.userId,
          name: activityTours.name,
          description: activityTours.description,
          updatedAt: activityTours.updatedAt,
        })
        .from(activityTours)
        .where(eq(activityTours.shareToken, token))
        .limit(1)
    : [];

  if (!tour) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const stageData = await getTourStages(tour.userId, tour.id, "manual");
  const stages = stageData?.stages ?? [];

  const stageIds = stages.map((s) => s.id);
  // Fotos aller Aufzeichnungen, auch der zusammengeführten — wie getTourPhotos.
  const recordingToStage = new Map<string, string>();
  for (const s of stages) {
    for (const rid of s.recordingIds) recordingToStage.set(rid, s.id);
  }
  const recordingIds = [...recordingToStage.keys()];

  const [detailRows, photoRows] = await Promise.all([
    stageIds.length === 0
      ? []
      : db
          .select({
            id: activities.id,
            routeData: activities.routeData,
            routeGeometry: activities.routeGeometry,
            notes: activities.notes,
          })
          .from(activities)
          .where(inArray(activities.id, stageIds)),
    recordingIds.length === 0
      ? []
      : db
          .select({
            id: activityPhotos.id,
            activityId: activityPhotos.activityId,
            width: activityPhotos.width,
            height: activityPhotos.height,
            takenAt: activityPhotos.takenAt,
            location: activityPhotos.location,
          })
          .from(activityPhotos)
          .where(inArray(activityPhotos.activityId, recordingIds))
          .orderBy(asc(activityPhotos.takenAt), asc(activityPhotos.id)),
  ]);

  const details = new Map(detailRows.map((d) => [d.id, d]));

  const photosByStage = new Map<
    string,
    {
      id: string;
      width: number | null;
      height: number | null;
      takenAt: string | null;
      location: string | null;
    }[]
  >();
  for (const p of photoRows) {
    const stageId = recordingToStage.get(p.activityId);
    if (!stageId) continue;
    const list = photosByStage.get(stageId) ?? [];
    list.push({
      id: p.id,
      width: p.width,
      height: p.height,
      takenAt: toIso(p.takenAt),
      location: p.location,
    });
    photosByStage.set(stageId, list);
  }

  const body = {
    tour: {
      id: tour.id,
      name: tour.name,
      description: tour.description,
      updatedAt: toIso(tour.updatedAt),
    },
    stages: stages.map((s) => {
      const d = details.get(s.id);
      let track = toTrack(d?.routeData);
      if (track.length === 0) track = toTrack(d?.routeGeometry);
      return {
        id: s.id,
        name: s.name,
        type: s.type,
        startTime: toIso(s.startTime),
        distance: s.distance,
        ascent: s.ascent,
        descent: s.descent,
        movingTime: s.movingTime,
        duration: s.duration,
        notes: d?.notes ?? null,
        locality: s.locality,
        track,
        photos: photosByStage.get(s.id) ?? [],
      };
    }),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": CACHE_HEADER },
  });
}
