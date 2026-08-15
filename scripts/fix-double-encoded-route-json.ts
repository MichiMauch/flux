/**
 * Findet und repariert doppelt kodierte JSON-Werte in activities.
 *
 * postgres.js leitet den Typ eines Parameters aus der Zielspalte ab. Steht da
 * json, serialisiert der Treiber den Wert selbst — ein bereits fertiger
 * JSON-String wird also ein zweites Mal stringifyt, und in der Spalte landet
 * ein JSON-*String* statt eines Arrays. Das passiert mit und ohne
 * ::json-Cast; richtig ist sql.json(wert) oder ein Write ueber Drizzle.
 *
 * Der Fehler ist lautlos: die Spalte ist gefuellt, aber jede Stelle die
 * Array.isArray() prueft (Routen-Vorschauen, Karten, HR- und Speed-Charts)
 * zeigt einfach nichts an.
 *
 * Der Fix packt den String wieder aus: (spalte #>> '{}')::json.
 * Idempotent — betrifft nur Zellen mit json_typeof() = 'string'.
 *
 * Ohne --write ist das ein reiner Report und taugt als Invarianten-Check:
 *
 *   npm run check:json-shape          # Dry-Run / Audit
 *   npx tsx scripts/fix-double-encoded-route-json.ts --write
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const write = process.argv.includes("--write");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    // Alle json/jsonb-Spalten der Tabelle, damit eine neue Spalte nicht
    // stillschweigend aus dem Check faellt.
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'activities' AND data_type IN ('json', 'jsonb')
      ORDER BY column_name
    `;

    let broken = 0;

    for (const { column_name: col } of cols) {
      const [{ n }] = await sql<{ n: string }[]>`
        SELECT count(*) AS n FROM activities WHERE json_typeof(${sql(col)}) = 'string'
      `;
      const count = Number(n);

      if (count === 0) {
        console.log(`✓ ${col.padEnd(18)} sauber`);
        continue;
      }

      broken += count;
      console.log(`✗ ${col.padEnd(18)} ${count} Zellen doppelt kodiert`);

      if (!write) continue;

      // Ein Statement pro Spalte, damit die Tabelle nicht halb repariert
      // dasteht falls unterwegs etwas schiefgeht.
      const res = await sql`
        UPDATE activities
        SET ${sql(col)} = (${sql(col)} #>> '{}')::json
        WHERE json_typeof(${sql(col)}) = 'string'
      `;
      console.log(`  ✓ ${res.count} repariert`);
    }

    if (broken === 0) {
      console.log("\nAlles sauber.");
    } else if (!write) {
      console.log(`\n${broken} Zellen betroffen — mit --write reparieren.`);
      process.exitCode = 1;
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
