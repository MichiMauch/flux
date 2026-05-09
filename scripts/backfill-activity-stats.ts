// Backfill für Aktivitäten, deren FIT-Session-Aggregate (moving_time, ascent,
// descent, min/max_altitude, avg/max_speed) NULL sind, obwohl route_data und
// speed_data vorliegen. Rechnet aus den gespeicherten Records nach.
//
// Usage:
//   npx tsx scripts/backfill-activity-stats.ts          # alle betroffenen
//   npx tsx scripts/backfill-activity-stats.ts <id>     # nur eine Activity
//   npx tsx scripts/backfill-activity-stats.ts --dry    # Preview ohne Update

import { config } from "dotenv";
import postgres from "postgres";
import {
  computeElevationStats,
  computeMovingTimeSec,
  computeSpeedStats,
  type RoutePoint,
  type SpeedSample,
} from "../src/lib/activity-stats";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const targetId = args.find((a) => !a.startsWith("--"));

  const sql = postgres(url);

  type Row = {
    id: string;
    name: string;
    moving_time: number | null;
    ascent: number | null;
    descent: number | null;
    min_altitude: number | null;
    max_altitude: number | null;
    avg_speed: number | null;
    max_speed: number | null;
    route_data: unknown;
    speed_data: unknown;
  };

  const rows: Row[] = targetId
    ? await sql<Row[]>`
        SELECT id, name, moving_time, ascent, descent,
               min_altitude, max_altitude, avg_speed, max_speed,
               route_data, speed_data
        FROM activities WHERE id = ${targetId}
      `
    : await sql<Row[]>`
        SELECT id, name, moving_time, ascent, descent,
               min_altitude, max_altitude, avg_speed, max_speed,
               route_data, speed_data
        FROM activities
        WHERE (moving_time IS NULL OR ascent IS NULL OR descent IS NULL
               OR min_altitude IS NULL OR max_altitude IS NULL
               OR avg_speed IS NULL OR max_speed IS NULL)
          AND (route_data IS NOT NULL OR speed_data IS NOT NULL)
        ORDER BY start_time DESC
      `;

  console.log(`Found ${rows.length} candidate activities${dry ? " (dry run)" : ""}`);

  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    const route = (Array.isArray(r.route_data) ? r.route_data : []) as RoutePoint[];
    const speed = (Array.isArray(r.speed_data) ? r.speed_data : []) as SpeedSample[];

    const elev = computeElevationStats(route);
    const sp = computeSpeedStats(speed);
    const mv = computeMovingTimeSec(speed);

    const next = {
      moving_time: r.moving_time ?? mv,
      ascent: r.ascent ?? elev.ascent,
      descent: r.descent ?? elev.descent,
      min_altitude: r.min_altitude ?? elev.minAlt,
      max_altitude: r.max_altitude ?? elev.maxAlt,
      avg_speed: r.avg_speed ?? sp.avg,
      max_speed: r.max_speed ?? sp.max,
    };

    const changed =
      next.moving_time !== r.moving_time ||
      next.ascent !== r.ascent ||
      next.descent !== r.descent ||
      next.min_altitude !== r.min_altitude ||
      next.max_altitude !== r.max_altitude ||
      next.avg_speed !== r.avg_speed ||
      next.max_speed !== r.max_speed;

    if (!changed) {
      skipped++;
      continue;
    }

    console.log(
      `[${r.id}] ${r.name}\n` +
        `   moving: ${r.moving_time} → ${next.moving_time}\n` +
        `   ascent: ${r.ascent} → ${next.ascent}\n` +
        `   descent: ${r.descent} → ${next.descent}\n` +
        `   alt: ${r.min_altitude}/${r.max_altitude} → ${next.min_altitude}/${next.max_altitude}\n` +
        `   speed: ${r.avg_speed}/${r.max_speed} → ${next.avg_speed}/${next.max_speed}`
    );

    if (!dry) {
      await sql`
        UPDATE activities SET
          moving_time = ${next.moving_time},
          ascent = ${next.ascent},
          descent = ${next.descent},
          min_altitude = ${next.min_altitude},
          max_altitude = ${next.max_altitude},
          avg_speed = ${next.avg_speed},
          max_speed = ${next.max_speed}
        WHERE id = ${r.id}
      `;
    }
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} unchanged${dry ? " (dry)" : ""}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
