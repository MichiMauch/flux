/**
 * Tagesdaten aus Google Health holen: Schritte, Kalorien, Distanz,
 * Zonenminuten und Intensitätsverteilung.
 *
 * Landet als eigene Zeile in daily_activity mit source = "google", neben der
 * Polar-Zeile desselben Tages. Welche davon angezeigt wird, entscheidet erst
 * die Leseschicht in daily-activity-query.ts — hier wird nichts zusammengeführt
 * und nichts überschrieben.
 *
 * Alle Werte kommen über dailyRollUp. Die Rohliste der Datenpunkte ist für
 * Tagessummen unbrauchbar: Google liefert dort Intraday-Buckets, im Vorabtest
 * waren es 261 Punkte für drei Tage.
 */

import {
  getValidAccessToken,
  dailyRollUp,
  rollupDate,
  type RollupPoint,
} from "@/lib/google-health-client";
import { db } from "@/lib/db";
import { users, dailyActivity, dailyGoogleExtras } from "@/lib/db/schema";

/**
 * Wie weit zurück Tagesdaten geholt werden. Die Uhr korrigiert einen Tag noch
 * nachträglich, wenn spät synchronisiert wird — eine Woche deckt das ab.
 */
const LOOKBACK_DAYS = 7;

/**
 * Bereichsgrenzen der API. Die meisten Typen erlauben 90 Tage, total-calories
 * und active-minutes nur 14. Bei LOOKBACK_DAYS = 7 spielt das keine Rolle, aber
 * die Grenze gehört dokumentiert, bevor jemand den Wert hochdreht.
 */
const MAX_RANGE_DAYS: Record<string, number> = {
  "total-calories": 14,
  "active-minutes": 14,
};

function toInt(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Ein Tag, aus allen Datentypen zusammengetragen. */
interface DayBucket {
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  distanceMm: number | null;
  azm: { fatBurn: number | null; cardio: number | null; peak: number | null };
  activeMinutes: { light: number | null; moderate: number | null; vigorous: number | null };
  raw: Record<string, RollupPoint>;
}

function emptyBucket(): DayBucket {
  return {
    steps: null,
    activeCalories: null,
    totalCalories: null,
    distanceMm: null,
    azm: { fatBurn: null, cardio: null, peak: null },
    activeMinutes: { light: null, moderate: null, vigorous: null },
    raw: {},
  };
}

export interface GoogleDailyResult {
  synced: number;
}

export async function syncGoogleDaily(
  user: typeof users.$inferSelect
): Promise<GoogleDailyResult> {
  if (!user.googleRefreshToken) return { synced: 0 };

  const token = await getValidAccessToken(user);

  // Nicht vor dem Stichtag. Auf Tagesebene wird der Kalendertag des Verbindens
  // mitgenommen: die Tagessumme rechnet Google serverseitig über den ganzen
  // Tag, es entsteht also kein halber Datensatz.
  const lookbackStart = daysAgo(LOOKBACK_DAYS);
  const cutoff = user.googleConnectedAt;
  const cutoffDay = cutoff
    ? new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), cutoff.getUTCDate()))
    : null;
  const from = cutoffDay && cutoffDay > lookbackStart ? cutoffDay : lookbackStart;

  // Ende ist ausschliessend, also einen Tag über heute hinaus, damit der
  // laufende Tag enthalten ist.
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + 1);

  const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  const byDate = new Map<string, DayBucket>();

  const bucket = (date: string): DayBucket => {
    const existing = byDate.get(date);
    if (existing) return existing;
    const fresh = emptyBucket();
    byDate.set(date, fresh);
    return fresh;
  };

  const types = [
    "steps",
    "active-energy-burned",
    "total-calories",
    "distance",
    "active-zone-minutes",
    "active-minutes",
  ];

  for (const dataType of types) {
    const limit = MAX_RANGE_DAYS[dataType];
    if (limit && spanDays > limit) {
      console.warn(
        `[google-daily] ${dataType} überspringt ${spanDays} Tage, erlaubt sind ${limit}`
      );
      continue;
    }
    let points: RollupPoint[];
    try {
      points = await dailyRollUp(token, dataType, from, to);
    } catch (e) {
      // Ein einzelner Datentyp darf den Rest nicht mitreissen — die Schritte
      // sind das Wichtigste, die Zonenminuten sind Beiwerk.
      console.warn(`[google-daily] ${dataType} fehlgeschlagen:`, e);
      continue;
    }

    for (const p of points) {
      const date = rollupDate(p);
      if (!date) continue;
      const b = bucket(date);
      b.raw[dataType] = p;

      if (p.steps?.countSum != null) b.steps = toInt(p.steps.countSum);
      if (p.activeEnergyBurned?.kcalSum != null) {
        b.activeCalories = toInt(p.activeEnergyBurned.kcalSum);
      }
      if (p.totalCalories?.kcalSum != null) b.totalCalories = toInt(p.totalCalories.kcalSum);
      if (p.distance?.millimetersSum != null) b.distanceMm = toInt(p.distance.millimetersSum);
      if (p.activeZoneMinutes) {
        b.azm = {
          fatBurn: toInt(p.activeZoneMinutes.sumInFatBurnHeartZone),
          cardio: toInt(p.activeZoneMinutes.sumInCardioHeartZone),
          peak: toInt(p.activeZoneMinutes.sumInPeakHeartZone),
        };
      }
      for (const lvl of p.activeMinutes?.activeMinutesRollupByActivityLevel ?? []) {
        const minutes = toInt(lvl.activeMinutesSum);
        if (lvl.activityLevel === "LIGHT") b.activeMinutes.light = minutes;
        if (lvl.activityLevel === "MODERATE") b.activeMinutes.moderate = minutes;
        if (lvl.activityLevel === "VIGOROUS") b.activeMinutes.vigorous = minutes;
      }
    }
  }

  let synced = 0;
  for (const [date, b] of byDate) {
    // Tage ohne jede Zahl gar nicht erst anlegen — sonst entsteht für jeden
    // Tag im Fenster eine leere Zeile, die in der Leseschicht mit der
    // Polar-Zeile konkurriert.
    if (b.steps == null && b.activeCalories == null && b.distanceMm == null) continue;

    // Aktive Minuten aller Intensitäten als Bewegungsdauer. Polar füllt
    // durationSec mit der aktiven Zeit des Tages, das ist die nächstliegende
    // Entsprechung.
    const activeMin =
      (b.activeMinutes.light ?? 0) +
      (b.activeMinutes.moderate ?? 0) +
      (b.activeMinutes.vigorous ?? 0);

    const values = {
      userId: user.id,
      date,
      source: "google",
      steps: b.steps,
      activeSteps: b.steps,
      calories: b.totalCalories,
      activeCalories: b.activeCalories,
      durationSec: activeMin > 0 ? activeMin * 60 : null,
      distance: b.distanceMm != null ? b.distanceMm / 1000 : null,
      updatedAt: new Date(),
    };

    await db
      .insert(dailyActivity)
      .values(values)
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.date, dailyActivity.source],
        set: values,
      });

    const extras = {
      userId: user.id,
      date,
      azmFatBurn: b.azm.fatBurn,
      azmCardio: b.azm.cardio,
      azmPeak: b.azm.peak,
      activeMinutesLight: b.activeMinutes.light,
      activeMinutesModerate: b.activeMinutes.moderate,
      activeMinutesVigorous: b.activeMinutes.vigorous,
      raw: b.raw,
      updatedAt: new Date(),
    };

    await db
      .insert(dailyGoogleExtras)
      .values(extras)
      .onConflictDoUpdate({
        target: [dailyGoogleExtras.userId, dailyGoogleExtras.date],
        set: extras,
      });

    synced++;
  }

  console.log(`[google-daily] ${synced} Tag(e) für ${user.name}`);
  return { synced };
}
