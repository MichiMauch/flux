import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url);

  const rows = await sql<
    Array<{
      id: string;
      polar_id: string | null;
      name: string;
      type: string;
      start_time: Date;
      duration: number | null;
      moving_time: number | null;
      distance: number | null;
      ascent: number | null;
      descent: number | null;
      min_altitude: number | null;
      max_altitude: number | null;
      avg_speed: number | null;
      max_speed: number | null;
      device: string | null;
      fit_file_path: string | null;
      route_data: unknown;
      speed_data: unknown;
    }>
  >`
    SELECT id, polar_id, name, type, start_time, duration, moving_time,
           distance, ascent, descent, min_altitude, max_altitude,
           avg_speed, max_speed, device, fit_file_path,
           route_data, speed_data
    FROM activities
    ORDER BY start_time DESC
    LIMIT 3
  `;

  for (const a of rows) {
    const route = Array.isArray(a.route_data)
      ? (a.route_data as Array<{ elevation?: number; time?: string }>)
      : [];
    const speed = Array.isArray(a.speed_data)
      ? (a.speed_data as Array<{ speed: number }>)
      : [];
    const elevations = route
      .map((p) => p.elevation)
      .filter((e): e is number => typeof e === "number");

    console.log({
      id: a.id,
      polar_id: a.polar_id,
      name: a.name,
      type: a.type,
      start_time: a.start_time,
      duration_sec: a.duration,
      moving_time_sec: a.moving_time,
      distance_m: a.distance,
      ascent_m: a.ascent,
      descent_m: a.descent,
      min_alt: a.min_altitude,
      max_alt: a.max_altitude,
      avg_speed: a.avg_speed,
      max_speed: a.max_speed,
      device: a.device,
      fit_file_path: a.fit_file_path,
      route_points: route.length,
      route_with_elev: elevations.length,
      route_elev_min: elevations.length ? Math.min(...elevations) : null,
      route_elev_max: elevations.length ? Math.max(...elevations) : null,
      speed_samples: speed.length,
      speed_max_kmh: speed.length ? Math.max(...speed.map((s) => s.speed)) : null,
    });
    console.log("---");
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
