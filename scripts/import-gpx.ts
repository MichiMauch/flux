import { readFileSync } from "fs";
import { XMLParser } from "fast-xml-parser";
import postgres from "postgres";
import { basename } from "path";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://flux:flux-prod-2026@localhost:5432/flux";

interface TrackPoint {
  "@_lat": string;
  "@_lon": string;
  ele?: number;
  time?: string;
}

async function importGpx(filePath: string, userId: string) {
  const sql = postgres(DATABASE_URL);
  const parser = new XMLParser({ ignoreAttributes: false });

  console.log(`\nParsing ${basename(filePath)}...`);
  const xml = readFileSync(filePath, "utf-8");
  const gpx = parser.parse(xml);

  const segments = gpx.gpx.trk.trkseg;
  const segArray = Array.isArray(segments) ? segments : [segments];

  // Collect all track points
  const allPoints: TrackPoint[] = [];
  for (const seg of segArray) {
    const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
    allPoints.push(...pts);
  }

  console.log(`  Total points: ${allPoints.length}`);

  // Sample every Nth point to keep it manageable (max ~500 points)
  const sampleRate = Math.max(1, Math.floor(allPoints.length / 500));
  const sampled = allPoints.filter((_, i) => i % sampleRate === 0);
  console.log(`  Sampled to: ${sampled.length} points (every ${sampleRate}th)`);

  // Build route data
  const routeData = sampled.map((pt) => ({
    lat: parseFloat(pt["@_lat"]),
    lng: parseFloat(pt["@_lon"]),
    elevation: pt.ele ?? null,
    time: pt.time ?? null,
  }));

  // Calculate stats
  const startTime = allPoints[0]?.time ? new Date(allPoints[0].time) : new Date();
  const endTime = allPoints[allPoints.length - 1]?.time
    ? new Date(allPoints[allPoints.length - 1].time!)
    : startTime;
  const durationSec = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Calculate distance (Haversine)
  let totalDistance = 0;
  for (let i = 1; i < allPoints.length; i++) {
    const lat1 = parseFloat(allPoints[i - 1]["@_lat"]);
    const lon1 = parseFloat(allPoints[i - 1]["@_lon"]);
    const lat2 = parseFloat(allPoints[i]["@_lat"]);
    const lon2 = parseFloat(allPoints[i]["@_lon"]);
    totalDistance += haversine(lat1, lon1, lat2, lon2);
  }

  // Calculate elevation gain
  let ascent = 0;
  let descent = 0;
  for (let i = 1; i < sampled.length; i++) {
    const diff = (sampled[i].ele ?? 0) - (sampled[i - 1].ele ?? 0);
    if (diff > 0) ascent += diff;
    else descent += Math.abs(diff);
  }

  // Calculate speed data (from sampled points)
  const speedData = [];
  for (let i = 1; i < sampled.length; i++) {
    const t1 = sampled[i - 1].time ? new Date(sampled[i - 1].time!).getTime() : 0;
    const t2 = sampled[i].time ? new Date(sampled[i].time!).getTime() : 0;
    const dt = (t2 - t1) / 1000; // seconds
    if (dt > 0) {
      const dist = haversine(
        parseFloat(sampled[i - 1]["@_lat"]),
        parseFloat(sampled[i - 1]["@_lon"]),
        parseFloat(sampled[i]["@_lat"]),
        parseFloat(sampled[i]["@_lon"])
      );
      const speed = (dist / dt) * 3.6; // km/h
      speedData.push({ time: sampled[i].time, speed: Math.round(speed * 10) / 10 });
    }
  }

  // Determine activity name from filename
  const fileName = basename(filePath);
  const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  const dateStr = dateMatch ? dateMatch[1] : "Unknown";
  const name = totalDistance > 10000 ? `Velofahrt ${dateStr}` : `Lauf ${dateStr}`;
  const type = totalDistance > 10000 ? "CYCLING" : "RUNNING";

  console.log(`  Name: ${name}`);
  console.log(`  Type: ${type}`);
  console.log(`  Start: ${startTime.toISOString()}`);
  console.log(`  Duration: ${Math.floor(durationSec / 60)}min ${durationSec % 60}s`);
  console.log(`  Distance: ${(totalDistance / 1000).toFixed(2)} km`);
  console.log(`  Ascent: ${ascent.toFixed(0)}m / Descent: ${descent.toFixed(0)}m`);

  // Insert into DB
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO activities (id, polar_id, user_id, name, type, start_time, duration, distance, ascent, descent, route_data, speed_data, created_at)
    VALUES (
      ${id},
      ${"gpx_" + dateStr + "_" + Date.now()},
      ${userId},
      ${name},
      ${type},
      ${startTime.toISOString()},
      ${durationSec},
      ${totalDistance},
      ${ascent},
      ${descent},
      ${JSON.stringify(routeData)},
      ${JSON.stringify(speedData)},
      NOW()
    )
  `;

  console.log(`  Imported as activity ${id}`);
  await sql.end();
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const sql = postgres(DATABASE_URL);
  const rows = await sql`SELECT id FROM "user" WHERE email = 'michi.mauch@gmail.com'`;
  const userId = rows[0]?.id;
  await sql.end();

  if (!userId) {
    console.error("User not found!");
    return;
  }

  console.log("User ID:", userId);

  const files = [
    "/Users/michaelmauch/Downloads/Michi_Mauch_2026-04-10_09-15-04.GPX",
    "/Users/michaelmauch/Downloads/Michi_Mauch_2026-04-12_12-04-35.GPX",
  ];

  for (const file of files) {
    await importGpx(file, userId);
  }

  console.log("\nDone! Both activities imported.");
}

main().catch(console.error);
