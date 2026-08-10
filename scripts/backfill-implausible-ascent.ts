/**
 * Repariert Aufstieg/Abstieg dort, wo das Gerät physikalisch unmögliche Werte
 * gemeldet hat.
 *
 * Hintergrund: alte Polar-Geräte (vor allem der V650) liefern teils absurde
 * barometrische Höhenmeter — eine 18-km-Wanderung kam mit 13'115 m Aufstieg in
 * die DB, bei einem Höhenband von 1717 m in derselben route_data. Die Route
 * selbst ist intakt (Höhenband und Zeitspanne passen zur Aktivität), nur die
 * Skalarwerte sind Müll.
 *
 * Ersetzt wird nur, was reconcileAscent() als unglaubwürdig einstuft: der
 * Gerätewert muss den aus der Route berechneten sowohl um den Faktor 2.5 als
 * auch um 1000 m übertreffen. Ein Barometer schlägt GPS-Höhe im Normalfall —
 * dieser Backfill greift ausschliesslich bei kaputten Werten ein.
 *
 *   npx tsx scripts/backfill-implausible-ascent.ts          # Dry-Run
 *   npx tsx scripts/backfill-implausible-ascent.ts --apply  # schreibt
 */
import { config } from "dotenv";
import postgres from "postgres";
import {
  computeElevationStats,
  reconcileAscent,
  type RoutePoint,
} from "../src/lib/activity-stats";

config({ path: ".env.local" });
config({ path: ".env" });

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
      ascent: number | null;
      descent: number | null;
      route_data: unknown;
    }[]
  >`
    SELECT id, name, device, ascent, descent, route_data
    FROM activities
    WHERE route_data IS NOT NULL AND (ascent IS NOT NULL OR descent IS NOT NULL)
  `;

  console.log(`${rows.length} Aktivitäten mit Route geprüft\n`);

  const fixes: {
    id: string;
    name: string;
    device: string;
    ascent: [number, number] | null;
    descent: [number, number] | null;
  }[] = [];

  for (const r of rows) {
    const elev = computeElevationStats(r.route_data as RoutePoint[]);
    const newAscent = reconcileAscent(r.ascent, elev.ascent);
    const newDescent = reconcileAscent(r.descent, elev.descent);
    const ascentChanged =
      r.ascent != null && newAscent != null && Math.round(newAscent) !== Math.round(r.ascent);
    const descentChanged =
      r.descent != null && newDescent != null && Math.round(newDescent) !== Math.round(r.descent);
    if (!ascentChanged && !descentChanged) continue;
    fixes.push({
      id: r.id,
      name: r.name ?? r.id,
      device: r.device ?? "unbekannt",
      ascent: ascentChanged ? [Math.round(r.ascent!), Math.round(newAscent!)] : null,
      descent: descentChanged ? [Math.round(r.descent!), Math.round(newDescent!)] : null,
    });
  }

  if (fixes.length === 0) {
    console.log("Keine unglaubwürdigen Werte gefunden.");
    await sql.end();
    return;
  }

  console.log(`${fixes.length} Aktivitäten mit unglaubwürdigen Höhenmetern:\n`);
  for (const f of fixes) {
    const a = f.ascent ? `↑ ${f.ascent[0]} → ${f.ascent[1]}` : "";
    const d = f.descent ? `↓ ${f.descent[0]} → ${f.descent[1]}` : "";
    console.log(`  ${f.device.padEnd(18)} ${f.name.slice(0, 38).padEnd(40)} ${a.padEnd(20)} ${d}`);
  }

  if (!apply) {
    console.log("\nDry-Run — nichts geschrieben. Mit --apply ausführen.");
    await sql.end();
    return;
  }

  let written = 0;
  for (const f of fixes) {
    if (f.ascent && f.descent) {
      await sql`UPDATE activities SET ascent = ${f.ascent[1]}, descent = ${f.descent[1]} WHERE id = ${f.id}`;
    } else if (f.ascent) {
      await sql`UPDATE activities SET ascent = ${f.ascent[1]} WHERE id = ${f.id}`;
    } else if (f.descent) {
      await sql`UPDATE activities SET descent = ${f.descent[1]} WHERE id = ${f.id}`;
    }
    written++;
  }
  console.log(`\n✓ ${written} Aktivitäten aktualisiert.`);

  await sql.end();
}

main();
