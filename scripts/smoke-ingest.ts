/**
 * Rauchtest fuer die gemeinsame Ingest-Pipeline.
 *
 *   tsx --env-file=.env.local scripts/smoke-ingest.ts
 *
 * Baut aus einem synthetischen Entwurf eine fertige Aktivitaetszeile und
 * schreibt NICHTS. Deckt ab, was beim Refactor von polar-sync.ts nach
 * activities/ingest.ts kaputtgehen koennte: TRIMP-Berechnung, Titelgenerierung,
 * Reverse-Geocoding und die Routen-Vorschau.
 *
 * Es gibt in diesem Projekt noch kein Testframework (siehe flux-ofw). Bis dahin
 * ist das hier die Absicherung dafuer, dass beide Quellen denselben Weg gehen.
 */

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { enrichActivity } from "../src/lib/activities/ingest";

async function main() {
  const email = process.argv[2] ?? "michi.mauch@gmail.com";
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error(`Kein User mit E-Mail ${email}`);

  const start = new Date("2026-09-07T16:37:51Z");
  const route = [
    { lat: 47.35612833, lng: 8.04803166, time: start.toISOString(), elevation: 422.3 },
    { lat: 47.35, lng: 8.05, time: new Date(start.getTime() + 600_000).toISOString(), elevation: 430 },
    { lat: 47.3388, lng: 8.0507, time: new Date(start.getTime() + 1_545_000).toISOString(), elevation: 435.7 },
  ];

  const row = await enrichActivity(user, {
    source: "polar",
    externalId: "smoke-test-wird-nicht-geschrieben",
    type: "WALKING",
    subType: "Gehen",
    fallbackTitle: "Gehen",
    startTime: start,
    duration: 1545,
    movingTime: 1530,
    distance: 2328,
    calories: 244,
    avgHeartRate: 97,
    maxHeartRate: 104,
    ascent: 11,
    descent: 2,
    minAltitude: 421,
    maxAltitude: 436,
    avgCadence: null,
    maxCadence: null,
    totalSteps: 2937,
    avgSpeed: 5.44,
    maxSpeed: 7.27,
    routeData: route,
    heartRateData: [{ time: start.toISOString(), bpm: 97 }],
    speedData: [{ time: start.toISOString(), speed: 5.4 }],
    device: "Pixel Watch 5",
    filePath: null,
  });

  const checks: [string, boolean, string][] = [
    ["Titel erzeugt", typeof row.name === "string" && row.name.length > 0, String(row.name)],
    ["Typ uebernommen", row.type === "WALKING", String(row.type)],
    ["Quelle gesetzt", row.source === "polar", String(row.source)],
    ["TRIMP berechnet", typeof row.trimp === "number" && row.trimp! > 0, String(row.trimp)],
    ["Ort aufgeloest", row.locality != null, `${row.locality} / ${row.country}`],
    [
      "Routen-Vorschau",
      Array.isArray(row.routeGeometry) && row.routeGeometry.length > 0,
      Array.isArray(row.routeGeometry) ? `${row.routeGeometry.length} Punkte` : "keine",
    ],
    [
      "Route unveraendert",
      Array.isArray(row.routeData) && row.routeData.length === route.length,
      Array.isArray(row.routeData) ? `${row.routeData.length} Punkte` : "keine",
    ],
  ];

  let failed = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(20)} ${detail}`);
    if (!ok) failed++;
  }

  console.log(failed === 0 ? "\nAlles gruen, nichts geschrieben." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
  await db.$client.end();
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  process.exit(1);
});
