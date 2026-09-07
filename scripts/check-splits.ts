/**
 * Rechnet die Runden einer Aktivitaet nach und zeigt Schnitt und Bestwert.
 *
 *   tsx --env-file=.env.local scripts/check-splits.ts <polar_id oder activity-id>
 *
 * Gedacht fuer flux-ug3: der Bestwert einer Runde wurde frueher von Trackpunkt
 * zu Trackpunkt gerechnet, wodurch jeder GPS-Sprung als Spitzenwert durchschlug
 * — bei einem Spaziergang mit 5.5 km/h Schnitt standen 11.9 km/h in der Runde.
 * Hier laesst sich pruefen, ob der Bestwert plausibel zum Schnitt passt.
 */

import { eq, or } from "drizzle-orm";
import { db } from "../src/lib/db";
import { activities } from "../src/lib/db/schema";
import { computeSplits, type RoutePoint, type HrSample } from "../src/lib/splits";

function kmh(paceSecPerKm: number | null): string {
  if (paceSecPerKm == null || paceSecPerKm <= 0) return "—";
  return (3600 / paceSecPerKm).toFixed(1);
}

async function main() {
  const key = process.argv[2];
  if (!key) throw new Error("Aktivitaets-ID oder polar_id als Argument angeben");

  const activity = await db.query.activities.findFirst({
    where: or(eq(activities.id, key), eq(activities.polarId, key)),
  });
  if (!activity) throw new Error(`Keine Aktivitaet zu ${key}`);

  const route = (activity.routeData ?? []) as RoutePoint[];
  const hr = (activity.heartRateData ?? []) as HrSample[];
  if (route.length < 2) throw new Error("Keine Route vorhanden");

  const splits = computeSplits(
    route,
    hr,
    activity.distance,
    activity.ascent,
    activity.descent,
  );

  console.log(`\n${activity.name}  (${activity.source})`);
  console.log(`Route: ${route.length} Punkte · Schnitt gesamt: ${activity.avgSpeed?.toFixed(1) ?? "—"} km/h · gespeicherter Max: ${activity.maxSpeed?.toFixed(1) ?? "—"} km/h\n`);
  console.log("  #   Distanz   Dauer     Schnitt   Bestwert   Verhaeltnis");

  let auffaellig = 0;
  splits.forEach((s, i) => {
    const avg = 3600 / (s.paceSecPerKm ?? Infinity);
    const best = s.paceBestSecPerKm ? 3600 / s.paceBestSecPerKm : null;
    const ratio = best && avg > 0 ? best / avg : null;
    // Nur ein Hinweis, kein Fehler: auf dem Velo hat ein Kilometer mit
    // Anstieg und Abfahrt voellig zu Recht eine grosse Spreizung. Zu Fuss ist
    // ein Bestwert weit ueber dem Schnitt dagegen ein Zeichen fuer GPS-Rauschen.
    const flag = ratio != null && ratio > 2 ? "  ← grosse Spreizung" : "";
    if (flag) auffaellig++;
    console.log(
      `  ${String(i + 1).padEnd(3)} ${s.distanceKm.toFixed(2)} km   ` +
        `${Math.round(s.durationSec)}s   ${kmh(s.paceSecPerKm)} km/h   ` +
        `${kmh(s.paceBestSecPerKm)} km/h   ${ratio ? ratio.toFixed(2) + "x" : "—"}${flag}`,
    );
  });

  console.log(
    auffaellig === 0
      ? "\nAlle Bestwerte nah am Rundenschnitt."
      : `\n${auffaellig} Runde(n) mit grosser Spreizung — bei Velofahrten normal, zu Fuss ein Verdachtsfall.`,
  );
  await db.$client.end();
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  // Drizzle verpackt Datenbankfehler; die Ursache steckt in cause.
  const cause = (e as { cause?: unknown })?.cause;
  if (cause) console.error("Ursache:", cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
