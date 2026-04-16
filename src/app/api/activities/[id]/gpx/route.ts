import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

interface RoutePoint {
  lat: number;
  lng: number;
  elevation?: number | null;
  time?: string | null;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildGpx(opts: {
  name: string;
  type: string;
  startTime: Date;
  route: RoutePoint[];
}): string {
  const metaTime = opts.startTime.toISOString();
  const trkpts = opts.route
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => {
      const parts: string[] = [];
      if (typeof p.elevation === "number") {
        parts.push(`      <ele>${p.elevation.toFixed(1)}</ele>`);
      }
      if (p.time) {
        parts.push(`      <time>${escapeXml(p.time)}</time>`);
      }
      const inner = parts.length > 0 ? "\n" + parts.join("\n") + "\n    " : "";
      return `    <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${inner}</trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Flux" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(opts.name)}</name>
    <time>${metaTime}</time>
  </metadata>
  <trk>
    <name>${escapeXml(opts.name)}</name>
    <type>${escapeXml(opts.type)}</type>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "activity";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, session.user.id)))
    .limit(1);

  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const route = (activity.routeData as RoutePoint[] | null) ?? [];
  if (route.length === 0) {
    return NextResponse.json({ error: "No route data" }, { status: 400 });
  }

  const gpx = buildGpx({
    name: activity.name,
    type: activity.type,
    startTime: activity.startTime,
    route,
  });

  const dateSlug = activity.startTime.toISOString().slice(0, 10);
  const filename = `${dateSlug}-${slugify(activity.name)}.gpx`;

  return new Response(gpx, {
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
