/**
 * Verschiebt die Höhen bestehender Google-Aktivitäten auf Meereshöhe.
 *
 * Die Pixel Watch liefert bei vielen Aufzeichnungen eine relative Höhe ab 0 m.
 * Neue Aktivitäten korrigiert der Sync (anchorTcxElevation), dieses Skript
 * holt die bereits importierten nach. Der Abgleich gegen swisstopo (Schweiz)
 * bzw. Open-Meteo (sonst) steht in src/lib/elevation-anchor.ts.
 *
 * Geändert werden route_data, min_altitude und max_altitude. Aufstieg und
 * Abstieg sind Differenzen und bleiben. Tracks mit kleinem Versatz (< 25 m)
 * gelten als korrekt und bleiben unangetastet — ein zweiter Lauf schreibt
 * deshalb nichts mehr.
 *
 *   npx tsx scripts/backfill-google-elevation.ts          # Dry-Run
 *   npx tsx scripts/backfill-google-elevation.ts --apply  # schreibt
 */
import { config } from "dotenv";
import postgres from "postgres";
import {
  findElevationAnchor,
  applyElevationAnchor,
} from "../src/lib/elevation-anchor";

config({ path: ".env.local" });
config({ path: ".env" });

type Point = { lat: number; lng: number; time?: string; elevation?: number };

function extremes(route: Point[]): [number, number] | null {
  const els = route
    .map((p) => p.elevation)
    .filter((e): e is number => typeof e === "number" && Number.isFinite(e));
  if (els.length === 0) return null;
  return [Math.min(...els), Math.max(...els)];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const apply = process.argv.includes("--apply");
  const sql = postgres(url, { max: 1, onnotice: () => {} });

  try {
    const rows = await sql<
      {
        id: string;
        start_time: Date;
        type: string | null;
        min_altitude: number | null;
        max_altitude: number | null;
        route_data: unknown;
      }[]
    >`
      SELECT id, start_time, type, min_altitude, max_altitude, route_data
      FROM activities
      WHERE source = 'google' AND route_data IS NOT NULL
      ORDER BY start_time
    `;
    console.log(`${rows.length} Google-Aktivitäten mit Route geprüft\n`);

    let changed = 0;
    for (const r of rows) {
      if (!Array.isArray(r.route_data)) continue;
      const route = r.route_data as Point[];
      const anchor = await findElevationAnchor(route);
      const shifted = applyElevationAnchor(route, anchor);
      const day = r.start_time.toISOString().slice(0, 10);
      const label = `${day}  ${(r.type ?? "").padEnd(8)}`;

      if (!anchor) {
        console.log(`  ${label}  kein Abgleich möglich, bleibt`);
        continue;
      }
      if (!shifted) {
        console.log(
          `  ${label}  ok (Versatz ${anchor.offset.toFixed(1)} m, ${anchor.source})`
        );
        continue;
      }

      const offset = Math.round(anchor.offset * 10) / 10;
      const ext = extremes(shifted);
      const shift = (v: number | null) =>
        v == null ? null : Math.round((v + offset) * 10) / 10;
      const newMin = shift(r.min_altitude) ?? ext?.[0] ?? null;
      const newMax = shift(r.max_altitude) ?? ext?.[1] ?? null;
      console.log(
        `  ${label}  ${r.min_altitude}..${r.max_altitude} → ${newMin}..${newMax}` +
          `  (+${offset} m, ${anchor.source}, n=${anchor.samples})`
      );
      changed++;

      if (apply) {
        // sql.json(), NICHT ${JSON.stringify(...)}::json — sonst landet ein
        // doppelt kodierter String in der Spalte (siehe
        // fix-double-encoded-route-json.ts).
        await sql`
          UPDATE activities
          SET route_data = ${sql.json(
            shifted as unknown as Parameters<typeof sql.json>[0]
          )},
              min_altitude = ${newMin},
              max_altitude = ${newMax}
          WHERE id = ${r.id}
        `;
      }
    }

    console.log(
      apply
        ? `\n✓ ${changed} Aktivitäten aktualisiert.`
        : `\nDry-Run — ${changed} Aktivitäten würden verschoben. Mit --apply ausführen.`
    );
  } finally {
    await sql.end();
  }
}

main();
