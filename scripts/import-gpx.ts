import { config } from "dotenv";
import { readFile } from "fs/promises";
import { XMLParser } from "fast-xml-parser";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

interface RoutePoint {
  lat: number;
  lng: number;
  elevation: number | null;
  time: string;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function parseGpx(xml: string): {
  name: string | null;
  type: string | null;
  points: RoutePoint[];
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: true,
    isArray: (name) => ["trk", "trkseg", "trkpt"].includes(name),
  });
  const doc = parser.parse(xml);
  const gpx = doc.gpx;
  if (!gpx) throw new Error("not a GPX file");

  const trks = gpx.trk ?? [];
  const trk = Array.isArray(trks) ? trks[0] : trks;
  const trkName: string | null =
    typeof trk?.name === "string" ? trk.name : null;
  const trkType: string | null =
    typeof trk?.type === "string" ? trk.type : null;

  const segs = trk?.trkseg ?? [];
  const segArr = Array.isArray(segs) ? segs : [segs];

  const points: RoutePoint[] = [];
  for (const seg of segArr) {
    const pts = seg?.trkpt ?? [];
    const ptsArr = Array.isArray(pts) ? pts : [pts];
    for (const pt of ptsArr) {
      const lat = Number(pt.lat);
      const lng = Number(pt.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const eleRaw =
        typeof pt.ele === "number"
          ? pt.ele
          : typeof pt.ele === "string"
            ? Number(pt.ele)
            : null;
      const time = typeof pt.time === "string" ? pt.time : null;
      if (!time) continue;
      points.push({
        lat,
        lng,
        elevation: Number.isFinite(eleRaw as number)
          ? (eleRaw as number)
          : null,
        time,
      });
    }
  }

  return { name: trkName, type: trkType, points };
}

function computeStats(points: RoutePoint[]) {
  let distance = 0;
  let ascent = 0;
  let descent = 0;
  let minAlt = Infinity;
  let maxAlt = -Infinity;
  for (let i = 1; i < points.length; i++) {
    distance += haversineMeters(points[i - 1], points[i]);
    const e0 = points[i - 1].elevation;
    const e1 = points[i].elevation;
    if (e0 != null && e1 != null) {
      const d = e1 - e0;
      if (d > 0) ascent += d;
      else descent -= d;
    }
    if (e1 != null) {
      if (e1 < minAlt) minAlt = e1;
      if (e1 > maxAlt) maxAlt = e1;
    }
  }
  const startTime = new Date(points[0].time);
  const endTime = new Date(points[points.length - 1].time);
  const duration = Math.round(
    (endTime.getTime() - startTime.getTime()) / 1000,
  );
  return {
    distance,
    ascent,
    descent,
    minAltitude: Number.isFinite(minAlt) ? minAlt : null,
    maxAltitude: Number.isFinite(maxAlt) ? maxAlt : null,
    startTime,
    duration,
  };
}

function mapType(gpxType: string | null): string {
  const lower = (gpxType ?? "").toLowerCase();
  if (lower.includes("run") || lower.includes("lauf")) return "RUNNING";
  if (lower.includes("hike") || lower.includes("wander")) return "HIKING";
  if (lower.includes("walk") || lower.includes("spazier")) return "WALKING";
  if (lower.includes("swim") || lower.includes("schwim")) return "SWIMMING";
  return "CYCLING";
}

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error(
      "Usage: npx tsx scripts/import-gpx.ts <gpx-path> [--user=<email>] [--name=<title>] [--type=<TYPE>] [--commit]",
    );
    process.exit(1);
  }
  const userArg = process.argv.find((a) => a.startsWith("--user="));
  const nameArg = process.argv.find((a) => a.startsWith("--name="));
  const typeArg = process.argv.find((a) => a.startsWith("--type="));
  const commit = process.argv.includes("--commit");
  const userEmail = userArg ? userArg.split("=")[1] : null;

  const xml = await readFile(file, "utf8");
  const { name: gpxName, type: gpxType, points } = parseGpx(xml);
  if (points.length === 0)
    throw new Error("GPX has no track points with time");
  const stats = computeStats(points);
  const type = typeArg ? typeArg.split("=")[1] : mapType(gpxType);
  const name =
    (nameArg ? nameArg.split("=")[1] : null) ?? gpxName ?? "GPX Import";

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url);

  let userId: string | null = null;
  if (userEmail) {
    const [u] = await sql<
      { id: string; email: string }[]
    >`SELECT id, email FROM "user" WHERE email = ${userEmail} LIMIT 1`;
    if (u) userId = u.id;
  } else {
    const userRows = await sql<
      { id: string; email: string }[]
    >`SELECT id, email FROM "user" ORDER BY email LIMIT 2`;
    if (userRows.length === 1) userId = userRows[0].id;
    else if (userRows.length > 1) {
      console.error(
        `Multiple users in DB — pass --user=<email>. Found:\n  ` +
          userRows.map((r) => r.email).join("\n  "),
      );
      await sql.end();
      process.exit(1);
    }
  }
  if (!userId) {
    console.error("No matching user found.");
    await sql.end();
    process.exit(1);
  }

  const summary = {
    file,
    name,
    type,
    userId,
    startTime: stats.startTime.toISOString(),
    durationSec: stats.duration,
    distanceM: Math.round(stats.distance),
    ascentM: Math.round(stats.ascent),
    descentM: Math.round(stats.descent),
    minAltitude: stats.minAltitude,
    maxAltitude: stats.maxAltitude,
    points: points.length,
    firstPoint: points[0],
    lastPoint: points[points.length - 1],
  };
  console.log("Parsed GPX:");
  console.log(summary);

  if (!commit) {
    console.log("\nDRY RUN — pass --commit to actually insert.");
    await sql.end();
    return;
  }

  const avgSpeed =
    stats.duration > 0 ? stats.distance / stats.duration : null;
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO activities (
      id, user_id, name, type, start_time, duration, moving_time,
      distance, ascent, descent, min_altitude, max_altitude,
      avg_speed, route_data, created_at
    ) VALUES (
      ${id},
      ${userId},
      ${name},
      ${type},
      ${stats.startTime},
      ${stats.duration},
      ${stats.duration},
      ${stats.distance},
      ${stats.ascent},
      ${stats.descent},
      ${stats.minAltitude},
      ${stats.maxAltitude},
      ${avgSpeed},
      ${sql.json(
        points.map((p) => ({
          lat: p.lat,
          lng: p.lng,
          elevation: p.elevation,
          time: p.time,
        })),
      )},
      NOW()
    )
  `;

  console.log(`\nInserted activity ${id} for user ${userId}.`);
  console.log(`Open: /activity/${id}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
