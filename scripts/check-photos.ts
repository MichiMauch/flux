import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url);

  const rows = await sql`
    SELECT
      id,
      activity_id,
      lat,
      lng,
      taken_at,
      location,
      width,
      height,
      created_at
    FROM activity_photos
    ORDER BY created_at DESC
    LIMIT 10
  `;

  console.log(`Last ${rows.length} photos:`);
  for (const r of rows) {
    console.log({
      id: r.id,
      activity: r.activity_id,
      lat: r.lat,
      lng: r.lng,
      taken_at: r.taken_at,
      location: r.location,
      size: `${r.width}x${r.height}`,
      created: r.created_at,
    });
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
