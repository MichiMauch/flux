/**
 * Regenerate AI titles for specific activities (by id) or for all of today.
 * Usage:
 *   npx tsx scripts/regenerate-titles.ts <id1> <id2> ...
 *   npx tsx scripts/regenerate-titles.ts --today
 *   npx tsx scripts/regenerate-titles.ts --today --dry
 */
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const today = args.includes("--today");
  const ids = args.filter((a) => !a.startsWith("--"));

  if (!today && ids.length === 0) {
    console.log("Usage: regenerate-titles.ts <id...> | --today [--dry]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!);

  // Dynamic import after env is loaded so db.ts picks up DATABASE_URL.
  const { generateActivityTitle, normalizePolarType } = await import(
    "../src/lib/ai-title"
  );

  let rows: {
    id: string;
    name: string;
    type: string;
    start_time: Date;
    distance: number | null;
    duration: number | null;
    moving_time: number | null;
    ascent: number | null;
    route_data: { lat: number; lng: number; time?: string }[] | null;
    user_name: string | null;
  }[];

  if (today) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    rows = await sql`
      SELECT a.id, a.name, a.type, a.start_time, a.distance, a.duration,
             a.moving_time, a.ascent, a.route_data, u.name AS user_name
      FROM activities a
      LEFT JOIN "user" u ON u.id = a.user_id
      WHERE a.start_time >= ${start}
      ORDER BY a.start_time DESC
    ` as typeof rows;
  } else {
    rows = await sql`
      SELECT a.id, a.name, a.type, a.start_time, a.distance, a.duration,
             a.moving_time, a.ascent, a.route_data, u.name AS user_name
      FROM activities a
      LEFT JOIN "user" u ON u.id = a.user_id
      WHERE a.id = ANY(${ids})
    ` as typeof rows;
  }

  if (rows.length === 0) {
    console.log("No matching activities.");
    await sql.end();
    return;
  }

  for (const a of rows) {
    const normalizedType = normalizePolarType(a.type, a.name);
    try {
      const newTitle = await generateActivityTitle({
        type: normalizedType,
        subType: a.name,
        startTime: a.start_time,
        distanceMeters: a.distance,
        durationSeconds: a.duration ?? a.moving_time,
        ascentMeters: a.ascent,
        routeData: a.route_data,
        fallbackTitle: a.name,
      });
      const changed = newTitle !== a.name;
      console.log(
        `[${a.user_name ?? "?"}] ${a.start_time.toISOString().slice(0, 16)} ${a.type}\n  old: "${a.name}"\n  new: "${newTitle}"${changed ? "" : "  (unchanged)"}`
      );
      if (changed && !dry) {
        await sql`UPDATE activities SET name = ${newTitle} WHERE id = ${a.id}`;
      }
    } catch (e) {
      console.warn(`Failed for ${a.id}:`, e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  await sql.end();
  console.log(dry ? "\nDry run — no changes written." : "\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
