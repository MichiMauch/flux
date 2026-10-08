/**
 * Transparentes Overlay für das Story-Video einer Aktivität: Route, Werte und
 * Titel im Layout des Foto-Designs, als PNG für ffmpeg.
 *
 * Liest bewusst ungecacht aus der Datenbank. Der Schlüssel, der mit dem PNG
 * zurückkommt, beschreibt alles, was im Overlay sichtbar ist — ändert sich
 * Titel, Distanz oder Route, ändert er sich mit, und das gespeicherte
 * Story-Video gilt als veraltet.
 */
import { ImageResponse } from "next/og";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import {
  activityTypeColor,
  activityTypeLabel,
  showsTerrain,
} from "@/lib/activity-types";
import { buildStoryStats, formatDate } from "./format";
import type { RoutePoint } from "./route-path";
import { StoryCard, STORY_HEIGHT, STORY_WIDTH } from "./story-designs";

// Bei Änderungen am Layout hochzählen, damit bestehende Story-Videos neu
// gerendert werden.
const OVERLAY_VERSION = 1;

export async function renderVideoOverlay(
  activityId: string
): Promise<{ png: Buffer; key: string } | null> {
  const [row] = await db
    .select({
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      distance: activities.distance,
      movingTime: activities.movingTime,
      duration: activities.duration,
      ascent: activities.ascent,
      routeGeometry: activities.routeGeometry,
      routeData: activities.routeData,
      ownerName: users.name,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(eq(activities.id, activityId))
    .limit(1);
  if (!row) return null;

  const terrain = showsTerrain(row.type);
  const geometry = row.routeGeometry as RoutePoint[] | null;
  const route = !terrain
    ? null
    : geometry && geometry.length > 1
      ? geometry
      : (row.routeData as RoutePoint[] | null);

  const props = {
    accent: activityTypeColor(row.type),
    typeLabel: activityTypeLabel(row.type).toUpperCase(),
    dateLabel: formatDate(row.startTime),
    ownerLabel: (row.ownerName ?? "Flux").toUpperCase(),
    title: row.name,
    stats: buildStoryStats(row, terrain),
  };
  const key = createHash("sha1")
    .update(JSON.stringify([OVERLAY_VERSION, props, route?.length ?? 0, route?.[0], route?.at(-1)]))
    .digest("hex");

  const image = new ImageResponse(
    (
      <StoryCard
        design="video"
        showGuides={false}
        {...props}
        mapUrl={null}
        photoUrl={null}
        route={route}
        isFlight={false}
      />
    ),
    { width: STORY_WIDTH, height: STORY_HEIGHT }
  );
  return { png: Buffer.from(await image.arrayBuffer()), key };
}
