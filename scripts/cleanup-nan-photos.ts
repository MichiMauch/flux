import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url);

  const broken = await sql<
    { id: string; activity_id: string; lat: number; lng: number }[]
  >`
    SELECT id, activity_id, lat, lng
    FROM activity_photos
    WHERE lat = 'NaN'::real OR lng = 'NaN'::real
       OR lat = 'Infinity'::real OR lng = 'Infinity'::real
       OR lat = '-Infinity'::real OR lng = '-Infinity'::real
  `;

  console.log(`Found ${broken.length} photos with non-finite coords:`);
  for (const r of broken) {
    console.log(`  ${r.id}  activity=${r.activity_id}  lat=${r.lat}  lng=${r.lng}`);
  }

  if (broken.length === 0) {
    await sql.end();
    return;
  }

  const dryRun = !process.argv.includes("--execute");
  if (dryRun) {
    console.log("\nDRY RUN — pass --execute to set lat/lng to NULL on these rows.");
    await sql.end();
    return;
  }

  const ids = broken.map((r) => r.id);
  const updated = await sql`
    UPDATE activity_photos
    SET lat = NULL, lng = NULL
    WHERE id IN ${sql(ids)}
    RETURNING id
  `;
  console.log(`\nReset ${updated.length} rows to lat=NULL, lng=NULL.`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
