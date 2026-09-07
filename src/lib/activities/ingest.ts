/**
 * Gemeinsame Nachbearbeitung beim Anlegen einer Aktivität.
 *
 * Titel, Ortsauflösung, Routen-Vorschau, TRIMP, Push und Trophäen hingen bis
 * hierher inline in syncPolarExercises. Mit Google als zweiter Quelle würden
 * die beiden Pfade sonst auseinanderlaufen — genau das, was der Kopfkommentar
 * von polar-sync.ts über die drei Trigger-Wege sagt, gilt jetzt eine Ebene
 * höher für die Quellen.
 *
 * Aufteilung in zwei Dateien, und zwar aus einem handfesten Grund: Diese hier
 * bleibt frei von `server-only`, damit Importskripte sie verwenden können.
 * `push.ts` und `trophies-server.ts` importieren `server-only`, ein Paket, das
 * Next zur Bauzeit auflöst, tsx aber nicht kennt — ein Skript, das darüber
 * stolpert, bricht mit MODULE_NOT_FOUND ab. `ai-title.ts` umgeht dieselbe
 * Falle bereits mit einer eigenen inline-Konstante.
 *
 * Also: `enrichActivity` hier (aufbereiten, skriptfähig), Insert samt Push und
 * Trophäen in ingest-effects.ts (serverseitig). Ein Importskript baut die Zeile
 * mit enrichActivity und schreibt sie selbst, ohne Push auszulösen.
 */

import { users, activities } from "@/lib/db/schema";
import { computeTrimp, type Sex } from "@/lib/trimp";
import { generateActivityTitle } from "@/lib/ai-title";
import { buildRouteGeometry } from "@/lib/activities/route-geometry";
import { reverseGeocodeStructured } from "@/lib/geocode";

export type RoutePointIn = {
  lat: number;
  lng: number;
  time?: string;
  elevation?: number;
};

/** Was eine Quelle liefern muss, damit daraus eine Aktivität wird. */
export interface ActivityDraft {
  /** "polar" | "google" | "strava" | "manual" */
  source: string;
  /** Externer Schlüssel inkl. Prefix, z.B. "google:123". Polar: nackte ID. */
  externalId: string | null;
  type: string;
  /** Rohbezeichnung der Quelle, geht als Kontext in die Titelgenerierung. */
  subType: string | null;
  /** Titel, falls die Generierung scheitert. Ohne Angabe subType, sonst type. */
  fallbackTitle?: string | null;
  startTime: Date;
  /** Sekunden, inklusive Pausen. */
  duration: number;
  /** Sekunden, ohne Pausen. */
  movingTime: number | null;
  distance: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  ascent: number | null;
  descent: number | null;
  minAltitude: number | null;
  maxAltitude: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  totalSteps: number | null;
  avgSpeed: number | null;
  maxSpeed: number | null;
  fatPercentage?: number | null;
  carbPercentage?: number | null;
  proteinPercentage?: number | null;
  cardioLoad?: number | null;
  cardioLoadInterpretation?: string | null;
  routeData: RoutePointIn[] | null;
  heartRateData: { time: string; bpm: number }[] | null;
  speedData: { time: string; speed: number }[] | null;
  device: string | null;
  /** Pfad zur archivierten Rohdatei (FIT oder TCX), falls vorhanden. */
  filePath: string | null;
}

type UserRow = typeof users.$inferSelect;

/**
 * Aus einem Entwurf die fertige Datenbankzeile bauen: TRIMP rechnen, Ort
 * auflösen, Titel erzeugen, Routen-Vorschau ableiten.
 *
 * Ort und Titel sind best effort. Schlägt das Geocoding fehl, bleiben die
 * Felder leer und ein Backfill kann sie später nachziehen; schlägt die
 * Titelgenerierung fehl, greift der Rückfalltitel.
 */
export async function enrichActivity(
  user: Pick<UserRow, "id" | "sex" | "birthday" | "maxHeartRate" | "restHeartRate">,
  draft: ActivityDraft
): Promise<typeof activities.$inferInsert> {
  const trimp = computeTrimp(
    {
      sex: user.sex as Sex,
      birthday: user.birthday,
      maxHeartRate: user.maxHeartRate,
      restHeartRate: user.restHeartRate,
    },
    {
      avgHeartRate: draft.avgHeartRate,
      maxHeartRate: draft.maxHeartRate,
      // Bewusst die verstrichene Zeit, nicht die Bewegungszeit. So rechnet der
      // Polar-Pfad seit jeher, und ein Wechsel würde den TRIMP aller künftigen
      // Polar-Aktivitäten gegenüber den bestehenden verschieben.
      duration: draft.duration,
    },
    draft.heartRateData
  );

  let locality: string | null = null;
  let country: string | null = null;
  let geocodedAt: Date | null = null;
  const start = draft.routeData?.[0];
  if (start && typeof start.lat === "number" && typeof start.lng === "number") {
    const loc = await reverseGeocodeStructured(start.lat, start.lng);
    if (loc) {
      locality = loc.locality;
      country = loc.country;
      geocodedAt = new Date();
    }
  }

  const fallbackTitle =
    draft.fallbackTitle?.trim() || draft.subType?.trim() || draft.type;
  let name = fallbackTitle;
  try {
    name = await generateActivityTitle({
      type: draft.type,
      subType: draft.subType,
      startTime: draft.startTime,
      distanceMeters: draft.distance,
      durationSeconds: draft.movingTime ?? draft.duration,
      ascentMeters: draft.ascent,
      routeData: draft.routeData,
      fallbackTitle,
    });
  } catch (e) {
    console.warn(`[ingest] Titelgenerierung fehlgeschlagen (${draft.externalId}):`, e);
  }

  return {
    polarId: draft.externalId,
    source: draft.source,
    userId: user.id,
    name,
    type: draft.type,
    startTime: draft.startTime,
    duration: draft.duration,
    movingTime: draft.movingTime,
    distance: draft.distance,
    calories: draft.calories,
    avgHeartRate: draft.avgHeartRate,
    maxHeartRate: draft.maxHeartRate,
    ascent: draft.ascent,
    descent: draft.descent,
    routeData: draft.routeData,
    routeGeometry: buildRouteGeometry(draft.routeData),
    heartRateData: draft.heartRateData,
    speedData: draft.speedData,
    minAltitude: draft.minAltitude,
    maxAltitude: draft.maxAltitude,
    avgCadence: draft.avgCadence,
    maxCadence: draft.maxCadence,
    totalSteps: draft.totalSteps,
    avgSpeed: draft.avgSpeed,
    maxSpeed: draft.maxSpeed,
    fatPercentage: draft.fatPercentage ?? null,
    carbPercentage: draft.carbPercentage ?? null,
    proteinPercentage: draft.proteinPercentage ?? null,
    cardioLoad: draft.cardioLoad ?? null,
    cardioLoadInterpretation: draft.cardioLoadInterpretation ?? null,
    trimp,
    device: draft.device,
    fitFilePath: draft.filePath,
    locality,
    country,
    geocodedAt,
  };
}
