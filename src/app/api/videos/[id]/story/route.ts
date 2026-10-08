/**
 * POST /api/videos/[id]/story
 *
 * Story-Video (1080×1920, Route und Werte eingebrannt) anfordern. Antwortet
 * sofort mit dem Stand: "ready", wenn ein passendes schon vorliegt, sonst
 * "processing" — das Rendern läuft dann im Hintergrund, der Client fragt per
 * GET /api/videos/[id]?meta=1 nach und holt das Ergebnis mit ?story=1.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities, activityVideos } from "@/lib/db/schema";
import { prepareStory } from "@/lib/video-jobs";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const [row] = await db
    .select({ activityId: activityVideos.activityId, ownerId: activities.userId })
    .from(activityVideos)
    .innerJoin(activities, eq(activityVideos.activityId, activities.id))
    .where(eq(activityVideos.id, id))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { state, work } = await prepareStory(id, row.activityId);
  if (work) after(work);
  return NextResponse.json(state);
}
