import { readFileSync } from "fs";
import FitParser from "fit-file-parser";
import postgres from "postgres";
import { basename } from "path";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt (z.B. aus .env.local laden)");
  return url;
}

const DATABASE_URL = requireDatabaseUrl();

// Nur die Felder, die dieses Script liest. fit-file-parser liefert untypisierte
// Objekte; Längen kommen wegen lengthUnit "km" in Kilometern.
interface FitRecord {
  timestamp?: string;
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  heart_rate?: number;
  speed?: number;
  enhanced_speed?: number;
}

interface FitSession {
  start_time?: string;
  sport?: string;
  sub_sport?: string;
  total_distance?: number;
  total_elapsed_time?: number;
  total_ascent?: number;
  total_descent?: number;
  total_calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
}

interface FitData {
  sessions?: FitSession[];
  records?: FitRecord[];
}

async function importFit(filePath: string, userId: string) {
  const sql = postgres(DATABASE_URL);

  console.log(`\nParsing ${basename(filePath)}...`);
  const buf = readFileSync(filePath);

  const data = await new Promise<FitData>((resolve, reject) => {
    const parser = new FitParser({ force: true, speedUnit: "km/h", lengthUnit: "km", elapsedRecordField: true });
    parser.parse(buf, (err, data) => {
      if (err || !data) reject(err ?? new Error("FIT-Datei ohne Inhalt"));
      else resolve(data as unknown as FitData);
    });
  });

  const session = data.sessions?.[0];
  if (!session) {
    console.error("  No session found in FIT file!");
    await sql.end();
    return;
  }

  // Sample records (max ~500 points)
  const records: FitRecord[] = data.records || [];
  const sampleRate = Math.max(1, Math.floor(records.length / 500));
  const sampled = records.filter((_: FitRecord, i: number) => i % sampleRate === 0);

  // Build route data
  const routeData = sampled
    .filter((r: FitRecord) => r.position_lat != null && r.position_long != null)
    .map((r: FitRecord) => ({
      lat: r.position_lat,
      lng: r.position_long,
      elevation: r.altitude ?? null,
      time: r.timestamp ?? null,
    }));

  // Build HR data
  const heartRateData = sampled
    .filter((r: FitRecord) => r.heart_rate != null && r.timestamp)
    .map((r: FitRecord) => ({ time: r.timestamp, bpm: r.heart_rate }));

  // Build speed data
  const speedData = sampled
    .filter((r: FitRecord) => (r.speed != null || r.enhanced_speed != null) && r.timestamp)
    .map((r: FitRecord) => ({ time: r.timestamp, speed: Math.round((r.enhanced_speed ?? r.speed ?? 0) * 10) / 10 }));

  const startTime = session.start_time ? new Date(session.start_time) : new Date();
  const sport = session.sport?.toUpperCase() || "OTHER";
  const subSport = session.sub_sport || "";
  const name = subSport ? `${sport} (${subSport})` : sport;
  const distance = (session.total_distance ?? 0) * 1000; // km → m
  const duration = Math.round(session.total_elapsed_time ?? 0);
  const ascent = (session.total_ascent ?? 0) * 1000; // km → m
  const descent = (session.total_descent ?? 0) * 1000;

  console.log(`  Sport: ${name}`);
  console.log(`  Start: ${startTime.toISOString()}`);
  console.log(`  Duration: ${Math.floor(duration / 60)}min ${duration % 60}s`);
  console.log(`  Distance: ${(distance / 1000).toFixed(2)} km`);
  console.log(`  Ascent: ${ascent.toFixed(0)}m`);
  console.log(`  Avg HR: ${session.avg_heart_rate} / Max HR: ${session.max_heart_rate}`);
  console.log(`  Records: ${records.length} → sampled ${sampled.length}`);

  const id = crypto.randomUUID();
  const polarId = `fit_${basename(filePath, ".FIT")}_${Date.now()}`;

  await sql`
    INSERT INTO activities (id, polar_id, user_id, name, type, start_time, duration, distance, calories, avg_heart_rate, max_heart_rate, ascent, descent, route_data, heart_rate_data, speed_data, created_at)
    VALUES (
      ${id}, ${polarId}, ${userId}, ${name}, ${sport},
      ${startTime.toISOString()}, ${duration}, ${distance},
      ${session.total_calories ?? null},
      ${session.avg_heart_rate ?? null}, ${session.max_heart_rate ?? null},
      ${ascent}, ${descent},
      ${sql.json(routeData)},
      ${sql.json(heartRateData)},
      ${sql.json(speedData)},
      NOW()
    )
  `;

  console.log(`  ✓ Imported as ${id}`);
  await sql.end();
}

async function main() {
  const sql = postgres(DATABASE_URL);
  const rows = await sql`SELECT id FROM "user" WHERE email = 'michi.mauch@gmail.com'`;
  const userId = rows[0]?.id;
  await sql.end();

  if (!userId) { console.error("User not found!"); return; }

  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log("Usage: npx tsx scripts/import-fit.ts <file1.FIT> [file2.FIT] ...");
    return;
  }

  for (const file of files) {
    await importFit(file, userId);
  }
  console.log("\nDone!");
}

main().catch(console.error);
