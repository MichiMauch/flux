import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const activityId = process.argv[2];
  if (!activityId) {
    console.error("Usage: npx tsx scripts/check-activity.ts <activity-id>");
    process.exit(1);
  }

  const sql = postgres(url);

  const rows = await sql<
    {
      id: string;
      name: string;
      start_time: Date;
      duration: number | null;
      moving_time: number | null;
      route_data: unknown;
    }[]
  >`
    SELECT id, name, start_time, duration, moving_time, route_data
    FROM activities
    WHERE id = ${activityId}
  `;

  if (rows.length === 0) {
    console.log("activity not found");
    await sql.end();
    return;
  }

  const a = rows[0];
  const route = (a.route_data as Array<{ lat: number; lng: number; time?: string }> | null) ?? null;
  const points = Array.isArray(route) ? route : [];
  const withTime = points.filter((p) => typeof p.time === "string");

  console.log({
    id: a.id,
    name: a.name,
    start_time: a.start_time,
    duration_sec: a.duration,
    moving_time_sec: a.moving_time,
    route_points: points.length,
    points_with_time: withTime.length,
    first_time: withTime[0]?.time ?? null,
    last_time: withTime[withTime.length - 1]?.time ?? null,
    sample_first_3: points.slice(0, 3),
  });

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
