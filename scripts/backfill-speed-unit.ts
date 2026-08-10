/**
 * Vereinheitlicht activities.avg_speed / max_speed auf km/h.
 *
 * Die Spalte enthielt je nach Importquelle unterschiedliche Einheiten: alle
 * Polar-Geräte schreiben km/h, die Strava-App m/s. Die UI multiplizierte
 * pauschal mit 3.6 und zeigte damit für 94 % der Aktivitäten ein 3.6-fach zu
 * hohes Ø-Tempo — ein Spaziergang mit 5.9 km/h erschien als 21.1 km/h.
 *
 * Die Einheit wird nicht geraten, sondern gegen distance/moving_time geprüft:
 * die beiden Deutungen liegen um den Faktor 3.6 auseinander, das ist eindeutig
 * entscheidbar. Umgerechnet wird nur, wenn die m/s-Deutung klar besser passt.
 * max_speed erbt die Entscheidung von avg_speed — beide stammen aus derselben
 * Quelle, für max gibt es keine eigene Referenz.
 *
 *   npx tsx scripts/backfill-speed-unit.ts          # Dry-Run
 *   npx tsx scripts/backfill-speed-unit.ts --apply  # schreibt
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/** Referenz muss belastbar sein — Kurzaktivitäten schwanken zu stark. */
const MIN_DISTANCE_M = 500;
const MIN_TIME_SEC = 120;
/** Die passende Deutung muss nah dran und die andere klar daneben sein. */
const MAX_ERROR_MATCH = 0.25;
const MIN_ERROR_MISMATCH = 0.5;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const apply = process.argv.includes("--apply");
  const sql = postgres(url);

  const rows = await sql<
    {
      id: string;
      name: string | null;
      device: string | null;
      distance: number | null;
      moving_time: number | null;
      duration: number | null;
      avg_speed: number | null;
      max_speed: number | null;
    }[]
  >`
    SELECT id, name, device, distance, moving_time, duration, avg_speed, max_speed
    FROM activities WHERE avg_speed IS NOT NULL AND avg_speed > 0
  `;

  const fixes: {
    id: string;
    name: string;
    device: string;
    avg: [number, number];
    max: [number, number] | null;
  }[] = [];
  let alreadyKmh = 0;
  let undecidable = 0;

  for (const r of rows) {
    const seconds = r.moving_time ?? r.duration ?? 0;
    if (
      (r.distance ?? 0) < MIN_DISTANCE_M ||
      seconds < MIN_TIME_SEC ||
      r.avg_speed == null
    ) {
      undecidable++;
      continue;
    }
    const referenceKmh = r.distance! / 1000 / (seconds / 3600);
    const errAsKmh = Math.abs(r.avg_speed - referenceKmh) / referenceKmh;
    const errAsMs = Math.abs(r.avg_speed * 3.6 - referenceKmh) / referenceKmh;

    if (errAsMs < MAX_ERROR_MATCH && errAsKmh > MIN_ERROR_MISMATCH) {
      fixes.push({
        id: r.id,
        name: r.name ?? r.id,
        device: r.device ?? "unbekannt",
        avg: [r.avg_speed, r.avg_speed * 3.6],
        max: r.max_speed != null ? [r.max_speed, r.max_speed * 3.6] : null,
      });
    } else if (errAsKmh < MAX_ERROR_MATCH) {
      alreadyKmh++;
    } else {
      undecidable++;
    }
  }

  console.log(`${rows.length} Aktivitäten mit avg_speed geprüft`);
  console.log(`  bereits km/h        : ${alreadyKmh}`);
  console.log(`  als m/s erkannt     : ${fixes.length}`);
  console.log(`  nicht entscheidbar  : ${undecidable} (bleiben unverändert)\n`);

  if (fixes.length === 0) {
    console.log("Nichts umzurechnen.");
    await sql.end();
    return;
  }

  for (const f of fixes.slice(0, 15))
    console.log(
      `  ${f.device.padEnd(14)} ${f.name.slice(0, 34).padEnd(36)} ` +
        `Ø ${f.avg[0].toFixed(2)} → ${f.avg[1].toFixed(1)} km/h` +
        (f.max ? `   max ${f.max[0].toFixed(2)} → ${f.max[1].toFixed(1)}` : ""),
    );
  if (fixes.length > 15) console.log(`  … und ${fixes.length - 15} weitere`);

  if (!apply) {
    console.log("\nDry-Run — nichts geschrieben. Mit --apply ausführen.");
    await sql.end();
    return;
  }

  for (const f of fixes) {
    if (f.max) {
      await sql`UPDATE activities SET avg_speed = ${f.avg[1]}, max_speed = ${f.max[1]} WHERE id = ${f.id}`;
    } else {
      await sql`UPDATE activities SET avg_speed = ${f.avg[1]} WHERE id = ${f.id}`;
    }
  }
  console.log(`\n✓ ${fixes.length} Aktivitäten auf km/h umgerechnet.`);

  await sql.end();
}

main();
