import { APP_TIME_ZONE } from "./activity-format";

/**
 * Zeitfenster für die teuren Polar-Syncs.
 *
 * Der Cron-Sweep läuft alle 30 Minuten, holt aber nur die Aktivitäten — das
 * ist ein Request pro User. Tagesdaten und Schlaf sind um Grössenordnungen
 * teurer (die Tagesdaten allein 9 Requests pro Tag × 7 Tage) und liefen früher
 * bei jedem Sweep mit. Das hat die App-Quote von Polar (5200 Requests im
 * langen Fenster) jeden Tag aufgebraucht, wonach gar nichts mehr synct.
 *
 * Deshalb laufen sie nur noch zu festen Stunden in APP_TIME_ZONE.
 */

/** Tagesdaten inkl. Extras: am Abend und um Mitternacht. */
export const DAILY_SYNC_HOURS = [0, 18];

/** Schlaf + Nightly Recharge: am Morgen, wenn die Uhr die Nacht hochgeladen hat. */
export const SLEEP_SYNC_HOURS = [7, 10];

/**
 * Mindestabstand zwischen zwei Läufen desselben Slots. Der Sweep feuert
 * innerhalb einer Slot-Stunde zweimal (:00 und :30) — der zweite Lauf soll
 * nicht nochmal syncen. Knapp unter einer Stunde, damit ein leicht verspäteter
 * Cron-Lauf den Slot trotzdem noch bedient.
 */
const MIN_GAP_MS = 55 * 60 * 1000;

/** Stunde (0–23) von `date` in APP_TIME_ZONE. */
export function localHour(date: Date): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(formatted);
}

/**
 * Ist dieser Sync jetzt fällig?
 *
 * Fällig heisst: Die lokale Stunde ist eine Slot-Stunde und der letzte
 * erfolgreiche Lauf ist lange genug her. `lastRun` wird nur nach einem
 * erfolgreichen Sync gestempelt — schlägt ein Lauf fehl (z.B. Polar-429),
 * versucht es der nächste Sweep in derselben Stunde erneut.
 */
export function isSlotDue(
  lastRun: Date | null | undefined,
  slotHours: number[],
  now: Date = new Date()
): boolean {
  if (!slotHours.includes(localHour(now))) return false;
  if (!lastRun) return true;
  return now.getTime() - lastRun.getTime() >= MIN_GAP_MS;
}
