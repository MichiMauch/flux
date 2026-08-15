/**
 * Repariert doppelt kodierte Routen-JSONs.
 *
 * scripts/backfill-route-geometry.ts hat route_geometry frueher mit
 * `${JSON.stringify(geom)}::json` geschrieben. postgres.js bindet den
 * Parameter wegen des Casts selbst als JSON und stringifyt den fertigen
 * String ein zweites Mal — in der Spalte steht dann ein JSON-*String*
 * statt eines Arrays. Die Karten pruefen Array.isArray() und zeigen
 * fuer solche Zeilen gar keine Route.
 *
 * Der Fix packt den String wieder aus: (spalte #>> '{}')::json.
 * Idempotent — betrifft nur Zeilen mit json_typeof() = 'string'.
 *
 *   npx tsx scripts/fix-double-encoded-route-json.ts          # Dry-Run
 *   npx tsx scripts/fix-double-encoded-route-json.ts --write  # schreibt
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import postgres from "postgres";

const COLUMNS = ["route_geometry", "route_data"] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const write = process.argv.includes("--write");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    for (const col of COLUMNS) {
      const affected = await sql<{ id: string; punkte: number }[]>`
        SELECT id,
               json_array_length((${sql(col)} #>> '{}')::json) AS punkte
        FROM activities
        WHERE json_typeof(${sql(col)}) = 'string'
        ORDER BY start_time DESC
      `;

      if (affected.length === 0) {
        console.log(`✓ ${col}: nichts zu tun`);
        continue;
      }

      const pts = affected.map((r) => r.punkte);
      console.log(
        `${col}: ${affected.length} Zeilen doppelt kodiert ` +
          `(${Math.min(...pts)}–${Math.max(...pts)} Punkte je Route)`
      );

      if (!write) {
        console.log(`  Dry-Run — mit --write ausfuehren`);
        continue;
      }

      // Ein Statement, damit die Tabelle nicht zeilenweise halb repariert
      // dasteht falls unterwegs etwas schiefgeht.
      const res = await sql`
        UPDATE activities
        SET ${sql(col)} = (${sql(col)} #>> '{}')::json
        WHERE json_typeof(${sql(col)}) = 'string'
      `;
      console.log(`  ✓ ${res.count} Zeilen repariert`);
    }

    const check = await sql<{ col: string; strings: string; arrays: string }[]>`
      SELECT 'route_geometry' AS col,
             count(*) FILTER (WHERE json_typeof(route_geometry) = 'string') AS strings,
             count(*) FILTER (WHERE json_typeof(route_geometry) = 'array')  AS arrays
      FROM activities
      UNION ALL
      SELECT 'route_data',
             count(*) FILTER (WHERE json_typeof(route_data) = 'string'),
             count(*) FILTER (WHERE json_typeof(route_data) = 'array')
      FROM activities
    `;
    console.log("\nStand danach:");
    for (const r of check) {
      console.log(`  ${r.col.padEnd(15)} array=${r.arrays}  string=${r.strings}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
