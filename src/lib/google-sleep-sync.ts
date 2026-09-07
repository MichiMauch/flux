/**
 * Schlaf aus Google Health holen.
 *
 * Landet als eigene Zeile in sleep_sessions mit source = "google", neben einer
 * etwaigen Polar-Nacht desselben Datums. Angezeigt wird, was die Leseschicht
 * auswählt — hier wird nichts überschrieben.
 *
 * Zwei Eigenheiten von Googles Schlafdaten:
 *
 *  1. sleep ist NICHT filterbar. Weder start_time noch civil_start_time werden
 *     akzeptiert. Also die Liste durchblättern und abbrechen, sobald sie hinter
 *     den Stichtag reicht.
 *  2. Auch Nickerchen kommen als vollwertige Sitzung, und `metadata.mainSleep`
 *     hilft nicht: ein 76-Minuten-Nickerchen am Nachmittag trug dasselbe
 *     mainSleep=true wie die Nacht davor. Deshalb gewinnt pro Tag schlicht die
 *     längste Sitzung. Das braucht keine Annahme darüber, was ein Nickerchen
 *     ist, und liefert bei nur einer Sitzung ohnehin dieselbe.
 */

import {
  getValidAccessToken,
  listSleep,
  listDailyRestingHeartRate,
  type GoogleSleep,
} from "@/lib/google-health-client";
import { db } from "@/lib/db";
import { users, sleepSessions, dailyGoogleExtras } from "@/lib/db/schema";

/** Wie viele Seiten à 25 Nächte höchstens geholt werden. */
const MAX_PAGES = 2;

/** Wie weit der Ruhepuls zurückgeholt wird. */
const RESTING_HR_DAYS = 30;

function toInt(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function minutesToSec(v: string | number | undefined | null): number | null {
  const m = toInt(v);
  return m == null ? null : m * 60;
}

/**
 * Das Datum, unter dem eine Nacht abgelegt wird: der Tag des AUFWACHENS in
 * lokaler Zeit. Polar handhabt es genauso, sonst lägen die beiden Quellen für
 * dieselbe Nacht auf verschiedenen Tagen und die Leseschicht könnte sie nie
 * gegeneinander abwägen.
 */
function wakeUpDate(endTime: string, endUtcOffset?: string): string {
  const offsetSec = endUtcOffset ? parseInt(endUtcOffset, 10) || 0 : 0;
  const local = new Date(new Date(endTime).getTime() + offsetSec * 1000);
  return local.toISOString().slice(0, 10);
}

/** Minuten einer Phase aus der fertigen Summary von Google. */
function stageMinutes(s: GoogleSleep["sleep"], type: string): number | null {
  const entry = s?.summary?.stagesSummary?.find((x) => x.type === type);
  return entry ? toInt(entry.minutes) : null;
}

export interface GoogleSleepResult {
  nights: number;
  restingHrDays: number;
}

export async function syncGoogleSleep(
  user: typeof users.$inferSelect
): Promise<GoogleSleepResult> {
  if (!user.googleRefreshToken) return { nights: 0, restingHrDays: 0 };

  const token = await getValidAccessToken(user);

  // Stichtag auf Tagesebene, nicht auf die Minute genau — genau wie bei den
  // Tagesdaten. Verbindet man abends, ist die Nacht davor bereits am
  // Verbindungstag zu Ende gegangen und gehört zu diesem Tag; mit einem
  // Zeitstempel-Vergleich fiele sie raus und man saehe bis zum naechsten
  // Morgen ueberhaupt keinen Schlaf. Aeltere Naechte bleiben draussen.
  const cutoffDay = user.googleConnectedAt
    ? user.googleConnectedAt.toISOString().slice(0, 10)
    : null;

  // ── Schlaf ───────────────────────────────────────────────────────────────
  const sessions = await listSleep(token, MAX_PAGES);

  // Pro Datum die längste Sitzung behalten.
  const best = new Map<string, { point: GoogleSleep; asleepMin: number }>();
  let skipped = 0;

  for (const p of sessions) {
    const iv = p.sleep?.interval;
    if (!iv?.endTime || !iv.startTime) continue;
    const date = wakeUpDate(iv.endTime, iv.endUtcOffset);
    if (cutoffDay && date < cutoffDay) {
      skipped++;
      continue;
    }
    const asleepMin = toInt(p.sleep?.summary?.minutesAsleep) ?? 0;
    const current = best.get(date);
    if (!current || asleepMin > current.asleepMin) {
      if (current) skipped++;
      best.set(date, { point: p, asleepMin });
    } else {
      skipped++;
    }
  }

  let nights = 0;
  for (const [date, { point }] of best) {
    const s = point.sleep!;
    const iv = s.interval!;

    const values = {
      userId: user.id,
      date,
      source: "google",
      polarUserId: null,
      deviceId: point.dataSource?.device?.displayName ?? null,
      sleepStartTime: new Date(iv.startTime!),
      sleepEndTime: new Date(iv.endTime!),
      totalSleepSec: minutesToSec(s.summary?.minutesAsleep),
      lightSleepSec: minutesToSec(stageMinutes(s, "LIGHT")),
      deepSleepSec: minutesToSec(stageMinutes(s, "DEEP")),
      remSleepSec: minutesToSec(stageMinutes(s, "REM")),
      unrecognizedSleepSec: null,
      // Polars Aufteilung in kurze und lange Unterbrechungen kennt Google
      // nicht — nur die Summe der Wachzeit.
      totalInterruptionSec: minutesToSec(s.summary?.minutesAwake),
      shortInterruptionSec: null,
      longInterruptionSec: null,
      sleepCycles: null,
      // Bewusst leer: Sleep Score, Sleep Charge, Continuity und die
      // Gruppenwertungen sind Polar-eigen. Ein geschätzter Wert wäre schlimmer
      // als eine leere Kachel.
      sleepScore: null,
      sleepCharge: null,
      sleepRating: null,
      continuity: null,
      continuityClass: null,
      groupDurationScore: null,
      groupSolidityScore: null,
      groupRegenerationScore: null,
      sleepGoalSec: user.sleepGoalSec ?? null,
      hypnogram: s.stages ?? null,
      heartRateSamples: null,
      raw: point as unknown,
      updatedAt: new Date(),
    };

    await db
      .insert(sleepSessions)
      .values(values)
      .onConflictDoUpdate({
        target: [sleepSessions.userId, sleepSessions.date, sleepSessions.source],
        set: values,
      });
    nights++;
  }

  // ── Ruhepuls ─────────────────────────────────────────────────────────────
  // Gehört zum Tag, nicht zur Nacht, und hat in sleep_sessions keine Spalte.
  let restingHrDays = 0;
  try {
    // Auch hier der Kalendertag: der Ruhepuls IST ein Tageswert, den Google
    // ueber den ganzen Tag rechnet. Ein Zeitstempel-Vergleich wuerde den
    // Verbindungstag selbst ausschliessen.
    const since = new Date(Date.now() - RESTING_HR_DAYS * 24 * 60 * 60 * 1000);
    const from = cutoffDay
      ? new Date(`${cutoffDay > since.toISOString().slice(0, 10) ? cutoffDay : since.toISOString().slice(0, 10)}T00:00:00Z`)
      : since;
    const points = await listDailyRestingHeartRate(token, from);

    for (const p of points) {
      const d = p.dailyRestingHeartRate?.date;
      const bpm = toInt(p.dailyRestingHeartRate?.beatsPerMinute);
      if (!d || bpm == null) continue;
      const date = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;

      await db
        .insert(dailyGoogleExtras)
        .values({ userId: user.id, date, restingHeartRate: bpm, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [dailyGoogleExtras.userId, dailyGoogleExtras.date],
          // Nur den Ruhepuls anfassen. Die Zonenminuten kommen aus dem
          // Tagesdaten-Sync und dürfen hier nicht auf null zurückfallen.
          set: { restingHeartRate: bpm, updatedAt: new Date() },
        });
      restingHrDays++;
    }
  } catch (e) {
    console.warn("[google-sleep] Ruhepuls fehlgeschlagen:", e);
  }

  console.log(
    `[google-sleep] ${nights} Nacht/Nächte für ${user.name}, ${skipped} übersprungen, ${restingHrDays} Tag(e) Ruhepuls`
  );
  return { nights, restingHrDays };
}
