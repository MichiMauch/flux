/**
 * Inspect today's activities (all users) — shows current title, type, route point count.
 * Usage: npx tsx scripts/inspect-today.ts
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await sql<
    {
      id: string;
      user_id: string;
      name: string;
      type: string;
      start_time: Date;
      distance: number | null;
      ascent: number | null;
      duration: number | null;
      route_data: { lat: number; lng: number }[] | null;
      user_name: string | null;
    }[]
  >`
    SELECT a.id, a.user_id, a.name, a.type, a.start_time, a.distance, a.ascent,
           a.duration, a.route_data, u.name AS user_name
    FROM activities a
    LEFT JOIN "user" u ON u.id = a.user_id
    WHERE a.start_time >= ${start}
    ORDER BY a.start_time DESC
  `;

  for (const r of rows) {
    const points = Array.isArray(r.route_data) ? r.route_data.length : 0;
    console.log(
      `[${r.user_name ?? r.user_id}] ${r.start_time.toISOString()} ${r.type} "${r.name}" — ${Math.round((r.distance ?? 0) / 100) / 10}km, ${points} GPS pts, ↗${Math.round(r.ascent ?? 0)}m  id=${r.id}`
    );
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
