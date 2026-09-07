/**
 * Aktivitäten aus Google Health nach flux holen.
 *
 * Gegenstück zu polar-sync.ts und wie dieses von mehreren Auslösern genutzt:
 * dem Webhook, dem Sync-Knopf und dem Cron-Sweep. Die eigentliche Aufbereitung
 * teilt es sich mit dem Polar-Pfad über activities/ingest.ts.
 *
 * Idempotent: activities.polar_id ist UNIQUE und trägt hier das Präfix
 * "google:", gelöschte Aktivitäten stehen auf der Blacklist. Ein zweiter Lauf
 * über dieselben Daten schreibt nichts.
 *
 * Wirft GoogleAuthError, wenn der Token abgelehnt wird — Aufrufer entscheiden,
 * wie sie "Google neu verbinden" anzeigen.
 */

import {
  getValidAccessToken,
  listExercises,
  exportExerciseTcx,
  rejectImportReason,
  dataPointId,
  parseGoogleDuration,
  GoogleAuthError,
  type GoogleExercise,
} from "@/lib/google-health-client";
import { parseTcxFile, reconcileGoogleAscent } from "@/lib/tcx-parser";
import { normalizeGoogleType } from "@/lib/google-sport-map";
import { enrichActivity, type ActivityDraft } from "@/lib/activities/ingest";
import { insertActivity, finishIngest } from "@/lib/activities/ingest-effects";
import { db } from "@/lib/db";
import { users, activities, deletedPolarActivities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

/**
 * Wie weit jeder Lauf zurückschaut. Was älter ist, kann nicht mehr neu
 * auftauchen — die Uhr lädt binnen Minuten hoch. Der Stichtag des Users
 * schneidet zusätzlich ab, je nachdem was später liegt.
 */
const LOOKBACK_DAYS = 14;

export interface GoogleSyncResult {
  synced: number;
  /** Verworfene Aktivitäten mit Grund, für die Auswertung der Importregel. */
  skipped: { id: string; reason: string }[];
  unlockedTrophies: string[];
}

function toNum(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function syncGoogleActivities(
  user: typeof users.$inferSelect
): Promise<GoogleSyncResult> {
  if (!user.googleRefreshToken) {
    return { synced: 0, skipped: [], unlockedTrophies: [] };
  }

  const token = await getValidAccessToken(user);

  const lookback = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const cutoff = user.googleConnectedAt;
  const since = cutoff && cutoff > lookback ? cutoff : lookback;

  const points = await listExercises(token, since);

  let synced = 0;
  const skipped: { id: string; reason: string }[] = [];

  for (const p of points) {
    const id = dataPointId(p.name);
    const reason = rejectImportReason(p, cutoff);
    if (reason) {
      skipped.push({ id, reason });
      continue;
    }

    const externalId = `google:${id}`;

    const existing = await db.query.activities.findFirst({
      where: eq(activities.polarId, externalId),
    });
    if (existing) continue;

    const blacklisted = await db.query.deletedPolarActivities.findFirst({
      where: and(
        eq(deletedPolarActivities.polarId, externalId),
        eq(deletedPolarActivities.userId, user.id)
      ),
    });
    if (blacklisted) continue;

    const draft = await buildDraft(token, user.id, p, externalId, id);
    const row = await enrichActivity(user, draft);
    await insertActivity(user, row);
    synced++;
  }

  let unlockedTrophies: string[] = [];
  if (synced > 0) {
    unlockedTrophies = await finishIngest(user.id, user.name);
  }

  for (const s of skipped) {
    console.log(`[google-sync] übersprungen ${s.id}: ${s.reason}`);
  }
  console.log(
    `[google-sync] ${synced} neue Aktivität(en) für ${user.name}, ${skipped.length} verworfen`
  );

  return { synced, skipped, unlockedTrophies };
}

/** Den Entwurf einer Aktivität aus Summary und, falls vorhanden, TCX bauen. */
async function buildDraft(
  token: string,
  userId: string,
  p: GoogleExercise,
  externalId: string,
  id: string
): Promise<ActivityDraft> {
  const ex = p.exercise!;
  const iv = ex.interval!;
  const startTime = new Date(iv.startTime!);

  let parsed: ReturnType<typeof parseTcxFile> | null = null;
  let filePath: string | null = null;

  if (ex.exerciseMetadata?.hasGps) {
    try {
      const tcx = await exportExerciseTcx(token, p.name);
      parsed = parseTcxFile(tcx);
      try {
        const dir = join(process.env.FIT_FILES_PATH || "/data/fit-files", userId);
        await mkdir(dir, { recursive: true });
        filePath = join(dir, `${id}.tcx`);
        await writeFile(filePath, tcx);
      } catch (e) {
        filePath = null;
        console.warn(`[google-sync] TCX nicht archiviert (${externalId}):`, e);
      }
    } catch (e) {
      // Kein Grund, die Aktivität fallenzulassen — ohne Track fehlen nur Karte
      // und Höhenprofil, die Summenwerte stehen in der Summary. Ein toter Token
      // ist etwas anderes und muss durchschlagen.
      if (e instanceof GoogleAuthError) throw e;
      console.warn(`[google-sync] TCX-Abruf fehlgeschlagen (${externalId}):`, e);
    }
  }

  const sum = ex.metricsSummary ?? {};
  const { type, known } = normalizeGoogleType(ex.exerciseType, ex.displayName);
  if (!known) {
    console.warn(
      `[google-sync] exerciseType "${ex.exerciseType}" unbekannt, per Heuristik auf ${type} abgebildet (${externalId})`
    );
  }

  const distanceMm = toNum(sum.distanceMillimeters);
  const distance =
    distanceMm != null ? distanceMm / 1000 : (parsed?.session?.totalDistance ?? null);
  const elapsed = Math.round(
    (new Date(iv.endTime!).getTime() - startTime.getTime()) / 1000
  );
  const movingTime = parseGoogleDuration(ex.activeDuration) || parsed?.session?.movingTime || null;

  return {
    source: "google",
    externalId,
    type,
    subType: ex.displayName ?? null,
    startTime,
    duration: elapsed,
    movingTime,
    distance,
    calories: toNum(sum.caloriesKcal),
    avgHeartRate:
      toNum(sum.averageHeartRateBeatsPerMinute) ?? parsed?.session?.avgHeartRate ?? null,
    // Den Maximalpuls liefert Google nicht in der Summary — er kommt
    // ausschliesslich aus den Pulswerten im TCX.
    maxHeartRate: parsed?.session?.maxHeartRate ?? null,
    ascent: reconcileGoogleAscent(
      toNum(sum.elevationGainMillimeters),
      parsed?.session?.totalAscent ?? null,
      { distanceMeters: distance, type }
    ),
    descent: parsed?.session?.totalDescent ?? null,
    minAltitude: parsed?.session?.minAltitude ?? null,
    maxAltitude: parsed?.session?.maxAltitude ?? null,
    // Trittfrequenz gibt es in Googles TCX nicht. Bewusst leer statt geschätzt.
    avgCadence: null,
    maxCadence: null,
    totalSteps: toNum(sum.steps),
    avgSpeed: parsed?.session?.avgSpeed ?? null,
    maxSpeed: parsed?.session?.maxSpeed ?? null,
    routeData: parsed?.routeData ?? null,
    heartRateData: parsed?.heartRateData ?? null,
    speedData: parsed?.speedData ?? null,
    device: p.dataSource?.device?.displayName ?? null,
    filePath,
  };
}
