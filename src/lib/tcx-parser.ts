/**
 * TCX-Parser für Aktivitäten aus der Google Health API.
 *
 * Gibt bewusst dieselbe Form zurück wie `parseFitFile`, damit die Ingest-
 * Pipeline (Route, Höhenprofil, Puls-Chart, TRIMP, Geocoding) für beide Quellen
 * dieselbe ist und nur der Parser getauscht wird.
 *
 * Was Googles TCX enthält und was nicht, gemessen an zwei Aufzeichnungen der
 * Pixel Watch 5 (rund 1500 Trackpoints, 25 bzw. 30 Minuten):
 *
 *   Position, AltitudeMeters, DistanceMeters   vorhanden, sekündlich
 *   HeartRateBpm                               vorhanden, aber nur auf etwa
 *                                              40 % der Trackpoints
 *   Cadence, Extensions (Speed, RunCadence)    NICHT vorhanden
 *
 * Geschwindigkeit muss deshalb aus der kumulativen DistanceMeters abgeleitet
 * werden. Trittfrequenz gibt es gar nicht — `avgCadence` und `maxCadence`
 * bleiben undefined statt einen Schätzwert vorzutäuschen.
 */

import { XMLParser } from "fast-xml-parser";
import {
  computeElevationStats,
  reconcileAscent,
  computeMovingTimeSec,
  computeSpeedStats,
  type RoutePoint,
  type SpeedSample,
} from "./activity-stats";

export interface ParsedTcxData {
  routeData: { lat: number; lng: number; time?: string; elevation?: number }[];
  heartRateData: { time: string; bpm: number }[];
  speedData: { time: string; speed: number }[];
  session: {
    minAltitude?: number;
    maxAltitude?: number;
    avgCadence?: number;
    maxCadence?: number;
    totalSteps?: number;
    avgSpeed?: number;
    maxSpeed?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    totalCalories?: number;
    totalAscent?: number;
    totalDescent?: number;
    totalDistance?: number;
    totalElapsedTime?: number;
    totalTimerTime?: number;
    movingTime?: number;
    sport?: string;
    subSport?: string;
  } | null;
}

// Sprünge über dieser Dauer gelten als Aufzeichnungslücke und liefern keinen
// Geschwindigkeitswert. Dieselbe Schwelle wie computeMovingTimeSec verwendet.
const SAMPLE_GAP_MAX_SEC = 10;

// Geschwindigkeit wird über mindestens dieses Fenster gebildet, nicht von
// Trackpoint zu Trackpoint. Grund: Die Uhr schreibt sekündlich, und beim ersten
// GPS-Fix springt die kumulative Distanz um einige Meter. Über eine Sekunde
// gerechnet wird daraus ein Spitzenwert von 11.9 km/h bei einem Spaziergang mit
// 5.4 km/h Schnitt — der landet dann als max_speed in der Datenbank. Der
// FIT-Pfad hat das Problem nicht, weil dort ein Gerätewert vorliegt; hier ist
// der Track die einzige Quelle. Drei Sekunden dämpfen den Ausreisser und lassen
// für den Chart immer noch reichlich Auflösung übrig.
const SPEED_WINDOW_MIN_SEC = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

/** Ein einzelnes Element, ein Array oder nichts — immer als Array zurück. */
function asArray(v: Node): Node[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseTcxFile(xml: string | Buffer): ParsedTcxData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    // Zahlen NICHT automatisch konvertieren: fast-xml-parser macht aus
    // "47.30" die Zahl 47.3 und aus "0008" die 8, was bei Koordinaten und
    // Zeitstempeln nur Ärger gibt. Wir casten selbst, kontrolliert.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml.toString());
  const activity = asArray(doc?.TrainingCenterDatabase?.Activities?.Activity)[0];

  const routeData: ParsedTcxData["routeData"] = [];
  const heartRateData: ParsedTcxData["heartRateData"] = [];
  const speedData: ParsedTcxData["speedData"] = [];

  let totalCalories: number | null = null;
  let totalTimeSeconds: number | null = null;
  let lapDistance: number | null = null;
  let maxHrFromSamples: number | null = null;
  let hrSum = 0;
  let hrCount = 0;

  // Für die Geschwindigkeitsableitung: letzter Punkt mit Zeit UND Distanz.
  let prevTime: number | null = null;
  let prevDistance: number | null = null;

  for (const lap of asArray(activity?.Lap)) {
    totalTimeSeconds = (totalTimeSeconds ?? 0) + (num(lap?.TotalTimeSeconds) ?? 0);
    lapDistance = (lapDistance ?? 0) + (num(lap?.DistanceMeters) ?? 0);
    totalCalories = (totalCalories ?? 0) + (num(lap?.Calories) ?? 0);

    for (const tp of asArray(lap?.Track?.Trackpoint)) {
      const rawTime = tp?.Time;
      // Ohne Zeitstempel ist ein Trackpoint für uns wertlos: alle drei
      // Zielreihen sind zeitindiziert.
      if (typeof rawTime !== "string") continue;
      const ms = Date.parse(rawTime);
      if (!Number.isFinite(ms)) continue;
      // Google liefert lokale Zeit mit Offset (…+02:00). Auf ISO-UTC
      // normalisieren, damit die Reihen zu denen aus dem FIT-Pfad passen.
      const time = new Date(ms).toISOString();

      const lat = num(tp?.Position?.LatitudeDegrees);
      const lng = num(tp?.Position?.LongitudeDegrees);
      const elevation = num(tp?.AltitudeMeters);

      // Die ersten Trackpoints haben regelmässig noch keine Position — die Uhr
      // braucht ein paar Sekunden bis zum GPS-Fix und schreibt bis dahin nur
      // Zeit und Puls. Solche Punkte überspringen, nicht abbrechen.
      if (lat != null && lng != null) {
        routeData.push({
          lat,
          lng,
          time,
          ...(elevation != null ? { elevation } : {}),
        });
      }

      const bpm = num(tp?.HeartRateBpm?.Value);
      if (bpm != null && bpm > 0) {
        heartRateData.push({ time, bpm });
        hrSum += bpm;
        hrCount++;
        if (maxHrFromSamples == null || bpm > maxHrFromSamples) {
          maxHrFromSamples = bpm;
        }
      }

      // DistanceMeters ist kumulativ über die Aktivität. Die Differenz zum
      // letzten Stützpunkt geteilt durch die Zeitdifferenz ergibt die
      // Geschwindigkeit — in km/h, weil der Rest von flux (Charts,
      // activities.avg_speed) km/h erwartet und nicht m/s.
      const distance = num(tp?.DistanceMeters);
      if (distance != null) {
        if (prevTime == null || prevDistance == null) {
          prevTime = ms;
          prevDistance = distance;
        } else {
          const dtSec = (ms - prevTime) / 1000;
          if (dtSec >= SAMPLE_GAP_MAX_SEC) {
            // Lücke in der Aufzeichnung: kein Wert, neu ansetzen.
            prevTime = ms;
            prevDistance = distance;
          } else if (dtSec >= SPEED_WINDOW_MIN_SEC) {
            const dDist = distance - prevDistance;
            if (dDist >= 0) speedData.push({ time, speed: (dDist / dtSec) * 3.6 });
            prevTime = ms;
            prevDistance = distance;
          }
          // Fenster noch nicht voll: Stützpunkt stehen lassen und weiterlaufen.
        }
      }
    }
  }

  if (routeData.length === 0 && heartRateData.length === 0) {
    return { routeData: [], heartRateData: [], speedData: [], session: null };
  }

  const elev = computeElevationStats(routeData as RoutePoint[]);
  const sp = computeSpeedStats(speedData as SpeedSample[]);
  const movingTime = computeMovingTimeSec(speedData as SpeedSample[]);

  const sport = typeof activity?.["@_Sport"] === "string" ? activity["@_Sport"] : undefined;
  const totalDistance = prevDistance ?? lapDistance ?? undefined;

  const session: ParsedTcxData["session"] = {
    minAltitude: elev.minAlt ?? undefined,
    maxAltitude: elev.maxAlt ?? undefined,
    // Trittfrequenz liefert Googles TCX nicht — bewusst nicht geschätzt.
    avgCadence: undefined,
    maxCadence: undefined,
    totalSteps: undefined,
    avgSpeed: sp.avg ?? undefined,
    maxSpeed: sp.max ?? undefined,
    avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
    maxHeartRate: maxHrFromSamples ?? undefined,
    totalCalories: totalCalories ?? undefined,
    // Kein Gerätewert vorhanden, der Track ist die einzige Quelle. reconcileAscent
    // bleibt trotzdem im Spiel, damit der Aufrufer den Wert aus der Google-Summary
    // (elevationGainMillimeters) dagegenhalten kann.
    totalAscent: elev.ascent ?? undefined,
    totalDescent: elev.descent ?? undefined,
    totalDistance: totalDistance ?? undefined,
    totalElapsedTime: totalTimeSeconds ?? undefined,
    totalTimerTime: totalTimeSeconds ?? undefined,
    movingTime: movingTime ?? undefined,
    sport,
    subSport: undefined,
  };

  return { routeData, heartRateData, speedData, session };
}

/**
 * Aufstieg aus Google-Summary und Track zusammenführen.
 *
 * Die Summary liefert `elevationGainMillimeters`, der Track die aus den
 * Höhenwerten integrierte Summe. Bei den Testaufzeichnungen lagen 3 m bzw.
 * 10.7 m aus der Summary gegen die geglättete Track-Summe — dieselbe Logik wie
 * beim FIT-Pfad entscheidet, welcher Wert plausibler ist.
 */
export function reconcileGoogleAscent(
  summaryMillimeters: number | null | undefined,
  trackAscent: number | null | undefined,
  context?: { distanceMeters?: number | null; type?: string | null }
): number | null {
  const summaryMeters =
    summaryMillimeters != null && Number.isFinite(summaryMillimeters)
      ? summaryMillimeters / 1000
      : null;
  return reconcileAscent(summaryMeters, trackAscent, context);
}
