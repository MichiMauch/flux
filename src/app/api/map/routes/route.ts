import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";

/**
 * Sport types shown on the overview map. Deliberately scoped to route-heavy
 * outdoor sports — everyday WALKING (the largest bucket) is left out to keep
 * the map (and payload) focused. Add types here to surface them.
 */
const MAP_SPORT_TYPES = ["HIKING", "CYCLING", "ROAD_BIKING"];

export interface MapRoutePoint {
  lat: number;
  lng: number;
}

export interface MapRoute {
  id: string;
  name: string;
  type: string;
  /** ISO string */
  startTime: string;
  distance: number | null;
  ascent: number | null;
  movingTime: number | null;
  /** simplified ~120-pt polyline */
  geometry: MapRoutePoint[];
}

/**
 * All GPS routes for the signed-in user, as compact ~120-pt polylines
 * (routeGeometry — NOT the full routeData track). Used by the /map overview.
 *
 * Deliberately NOT wrapped in unstable_cache: the full geometry set for a
 * large account can approach/exceed the 2 MB unstable_cache limit (see the
 * note in cache/activity-filters.ts), at which point it silently stops
 * caching anyway. Instead the query is a single indexed scan on
 * activities(user_id) and we let the browser cache the response.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rows = await db
    .select({
      id: activities.id,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      distance: activities.distance,
      ascent: activities.ascent,
      movingTime: activities.movingTime,
      geometry: activities.routeGeometry,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        isNotNull(activities.routeGeometry),
        inArray(activities.type, MAP_SPORT_TYPES),
      ),
    )
    .orderBy(desc(activities.startTime));

  const routes: MapRoute[] = [];
  for (const r of rows) {
    const geometry = r.geometry as MapRoutePoint[] | null;
    if (!Array.isArray(geometry) || geometry.length < 2) continue;
    routes.push({
      id: r.id,
      name: r.name,
      type: r.type,
      startTime: r.startTime.toISOString(),
      distance: r.distance,
      ascent: r.ascent,
      movingTime: r.movingTime,
      geometry,
    });
  }

  return NextResponse.json(
    { routes },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
