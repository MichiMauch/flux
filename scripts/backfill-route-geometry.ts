import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import postgres from "postgres";
import { buildRouteGeometry } from "../src/lib/activities/route-geometry";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "route_geometry" json`;
    console.log("✓ Column route_geometry ensured");

    const todo = await sql<{ id: string }[]>`
      SELECT id FROM activities
      WHERE route_data IS NOT NULL AND route_geometry IS NULL
      ORDER BY start_time DESC
    `;
    console.log(`Backfilling ${todo.length} activities…`);

    let written = 0;
    let skipped = 0;
    let dropped = 0;
    const t0 = Date.now();
    for (const { id } of todo) {
      const [row] = await sql<{ route_data: unknown }[]>`
        SELECT route_data FROM activities WHERE id = ${id}
      `;
      const geom = buildRouteGeometry(row?.route_data);
      if (!geom) {
        dropped++;
        continue;
      }
      const inputLen = Array.isArray(row.route_data)
        ? (row.route_data as unknown[]).length
        : 0;
      await sql`
        UPDATE activities
        SET route_geometry = ${JSON.stringify(geom)}::json
        WHERE id = ${id}
      `;
      written++;
      if (written % 50 === 0) {
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(
          `  ${written}/${todo.length} (last ${inputLen}→${geom.length} pts, ${dt}s elapsed)`,
        );
      }
    }
    console.log(
      `\n✓ Backfill complete: ${written} written, ${skipped} skipped, ${dropped} dropped (no usable points)`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
