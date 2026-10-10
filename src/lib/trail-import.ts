/**
 * Eine Wanderung aus flux-trail (der eigenen App auf der Pixel Watch) zu einem
 * Aktivitäts-Entwurf machen.
 *
 * Gegenstück zu google-sync.ts und polar-sync.ts, mit einem Unterschied in der
 * Richtung: Polar und Google werden hier abgeholt, flux-trail liefert an. Die
 * Uhr schickt den Track erst, wenn auf ihr «Speichern» gewählt wurde — von
 * selbst kommt nichts.
 *
 * Die Aufbereitung danach ist dieselbe wie bei den anderen Quellen
 * (activities/ingest.ts). Hier entsteht nur der Entwurf: Punkte prüfen, Höhe
 * verankern, Tempo und Summen aus dem Track rechnen.
 *
 * Frei von `server-only` und von der Datenbank, wie ingest.ts — so lässt sich
 * ein Track auch aus einem Skript nachimportieren.
 */

import type { ActivityDraft, RoutePointIn } from "@/lib/activities/ingest";
import {
  computeElevationStats,
  computeSpeedStats,
  reconcileAscent,
  type RoutePoint,
  type SpeedSample,
} from "@/lib/activity-stats";
import { findElevationAnchor, applyElevationAnchor } from "@/lib/elevation-anchor";

/** Ein Punkt, wie die Uhr ihn schickt: Zeit in ms, Breite, Länge, Höhe, Puls. */
type TrailPoint = [number, number, number, number | null, number | null];

export interface TrailTrack {
  /** Auf der Uhr erzeugte UUID. Unter ihr ist der Upload wiederholbar. */
  id: string;
  /** Name der Fluxtour-Tour, falls nach einer gewandert wurde. */
  tourName: string | null;
  device: string | null;
  /** Was auf der Uhr vor dem Start gewählt wurde. */
  sport: TrailSport;
  startMs: number;
  endMs: number;
  /** Aktive Dauer ohne Pausen, wie Health Services sie zählt. */
  activeMs: number;
  distanceM: number | null;
  ascentM: number | null;
  calories: number | null;
  steps: number | null;
  points: TrailPoint[];
}

/** Die Sportarten, die die Uhr zur Wahl stellt — in den Namen, die flux für `type` führt. */
const SPORTS = ["HIKING", "CYCLING", "RUNNING", "WALKING"] as const;
export type TrailSport = (typeof SPORTS)[number];

/** Der Titel, falls weder eine Tour ihren Namen mitbringt noch die KI einen findet. */
const FALLBACK_TITLE: Record<TrailSport, string> = {
  HIKING: "Wanderung",
  CYCLING: "Radtour",
  RUNNING: "Lauf",
  WALKING: "Spaziergang",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Ein Punkt pro Sekunde über vierzig Stunden. Mehr ist kein Track, sondern ein
// Fehler oder ein Versuch, den Server zu beschäftigen.
const MAX_POINTS = 150_000;

// Dieselben Schwellen wie im TCX-Pfad (tcx-parser.ts), aus demselben Grund:
// Tempo über ein Fenster statt von Punkt zu Punkt, sonst wird aus einem
// GPS-Sprung beim ersten Fix ein Spitzenwert, und über Lücken gar keines.
const SAMPLE_GAP_MAX_SEC = 10;
const SPEED_WINDOW_MIN_SEC = 3;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function nonNegative(v: unknown): number | null {
  const n = num(v);
  return n != null && n >= 0 ? n : null;
}

function text(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Den Rumpf des Uploads prüfen. `null`, wenn er nicht taugt.
 *
 * Die Uhr ist über das geteilte Geheimnis ausgewiesen und damit
 * vertrauenswürdig; geprüft wird trotzdem, weil ein NaN in einer real-Spalte
 * jede Seite lahmlegt, die die Aktivität später anfasst.
 */
export function parseTrailTrack(body: unknown): TrailTrack | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (typeof b.id !== "string" || !UUID.test(b.id)) return null;
  const startMs = num(b.startMs);
  const endMs = num(b.endMs);
  if (startMs == null || endMs == null || endMs < startMs) return null;
  if (!Array.isArray(b.points) || b.points.length === 0 || b.points.length > MAX_POINTS) {
    return null;
  }

  const points: TrailPoint[] = [];
  for (const raw of b.points) {
    if (!Array.isArray(raw)) return null;
    const t = num(raw[0]);
    const lat = num(raw[1]);
    const lng = num(raw[2]);
    if (t == null || lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const bpm = num(raw[4]);
    points.push([t, lat, lng, num(raw[3]), bpm != null && bpm > 0 && bpm < 260 ? Math.round(bpm) : null]);
  }
  // Health Services liefert die Punkte in Stapeln; über die Stapelgrenze hinweg
  // ist die Reihenfolge nicht zugesichert.
  points.sort((a, b) => a[0] - b[0]);

  return {
    id: b.id,
    tourName: text(b.tourName, 120),
    device: text(b.device, 60),
    // Eine Uhr mit der App von früher schickt das Feld nicht; damals gab es nur Wandern.
    sport: SPORTS.find((s) => s === b.sport) ?? "HIKING",
    startMs,
    endMs,
    activeMs: nonNegative(b.activeMs) ?? 0,
    distanceM: nonNegative(b.distanceM),
    ascentM: nonNegative(b.ascentM),
    calories: nonNegative(b.calories),
    steps: nonNegative(b.steps),
    points,
  };
}

/** Unter diesem Schlüssel steht die Wanderung in `activities.polar_id`. */
export function trailExternalId(id: string): string {
  return `flux-trail:${id}`;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Aus dem geprüften Track den Entwurf bauen. `filePath` setzt der Aufrufer. */
export async function buildTrailDraft(track: TrailTrack): Promise<ActivityDraft> {
  let routeData: RoutePointIn[] = track.points.map(([t, lat, lng, elevation]) => ({
    lat,
    lng,
    time: new Date(t).toISOString(),
    ...(elevation != null ? { elevation } : {}),
  }));

  // Die Uhr misst die Höhe mit dem Barometer, und das liegt ohne Abgleich um
  // Dutzende Meter daneben (im ersten Test 402 m statt 428 m). Der Verlauf
  // stimmt, der Sockel nicht — derselbe Befund wie bei Googles TCX.
  try {
    const anchor = await findElevationAnchor(routeData);
    const shifted = applyElevationAnchor(routeData, anchor);
    if (shifted && anchor) {
      routeData = shifted;
      console.log(
        `[trail] Höhe um ${Math.round(anchor.offset * 10) / 10} m verschoben (${anchor.source}, ${anchor.samples} Stichproben)`
      );
    }
  } catch (e) {
    // Eine Wanderung fällt nie wegen eines Höhendienstes aus dem Import.
    console.warn("[trail] Höhenabgleich fehlgeschlagen:", e);
  }

  const heartRateData: { time: string; bpm: number }[] = [];
  const speedData: SpeedSample[] = [];
  let hrSum = 0;
  let hrMax: number | null = null;
  let trackDistance = 0;
  let prev: TrailPoint | null = null;
  let windowStart: { t: number; dist: number } | null = null;

  for (const p of track.points) {
    const [t, lat, lng, , bpm] = p;
    const time = new Date(t).toISOString();
    if (bpm != null) {
      heartRateData.push({ time, bpm });
      hrSum += bpm;
      if (hrMax == null || bpm > hrMax) hrMax = bpm;
    }

    if (prev) {
      const dtSec = (t - prev[0]) / 1000;
      if (dtSec >= SAMPLE_GAP_MAX_SEC) {
        // Eine Pause oder eine Lücke: Die Strecke dazwischen ist nicht
        // gegangen worden, jedenfalls nicht aufgezeichnet.
        windowStart = null;
      } else {
        trackDistance += haversineM(prev[1], prev[2], lat, lng);
      }
    }
    if (!windowStart) {
      windowStart = { t, dist: trackDistance };
    } else {
      const dtSec = (t - windowStart.t) / 1000;
      if (dtSec >= SPEED_WINDOW_MIN_SEC) {
        // km/h, wie überall in flux.
        speedData.push({ time, speed: ((trackDistance - windowStart.dist) / dtSec) * 3.6 });
        windowStart = { t, dist: trackDistance };
      }
    }
    prev = p;
  }

  const elev = computeElevationStats(routeData as RoutePoint[]);
  const speed = computeSpeedStats(speedData);
  // Die Uhr zählt die Distanz mit Schrittsensor und GPS zusammen und ist damit
  // dem nackten Track überlegen. Fehlt ihr Wert, bleibt der Track.
  const distance = track.distanceM ?? (trackDistance > 0 ? trackDistance : null);
  const type = track.sport;

  return {
    source: "flux-trail",
    externalId: trailExternalId(track.id),
    type,
    subType: track.tourName,
    fallbackTitle: track.tourName ?? FALLBACK_TITLE[type],
    startTime: new Date(track.startMs),
    duration: Math.round((track.endMs - track.startMs) / 1000),
    movingTime: track.activeMs > 0 ? Math.round(track.activeMs / 1000) : null,
    distance,
    calories: track.calories != null ? Math.round(track.calories) : null,
    avgHeartRate: heartRateData.length > 0 ? Math.round(hrSum / heartRateData.length) : null,
    maxHeartRate: hrMax,
    ascent: reconcileAscent(track.ascentM, elev.ascent, { distanceMeters: distance, type }),
    descent: elev.descent,
    minAltitude: elev.minAlt,
    maxAltitude: elev.maxAlt,
    avgCadence: null,
    maxCadence: null,
    totalSteps: track.steps != null ? Math.round(track.steps) : null,
    avgSpeed: speed.avg,
    maxSpeed: speed.max,
    routeData,
    heartRateData: heartRateData.length > 0 ? heartRateData : null,
    speedData: speedData.length > 0 ? speedData : null,
    device: track.device,
    filePath: null,
  };
}
