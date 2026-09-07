/**
 * Leseschicht für Tagesdaten mit mehreren Quellen.
 *
 * Seit die Pixel Watch neben der Polar-Uhr läuft, kann derselbe Tag zwei Zeilen
 * in daily_activity haben — eine pro Quelle. Trägt man morgens die eine und
 * nachmittags die andere, deckt keine der beiden den Tag vollständig ab:
 * Polar zählt nur den Nachmittag, Google den Vormittag plus das, was das Handy
 * nebenbei mitbekommt. Addieren wäre falsch, weil sich die Zeiträume
 * überlappen können.
 *
 * Regel, mit dem User abgestimmt: **Pro Tag gewinnt die Quelle mit den meisten
 * Schritten.** Hat nur eine Quelle Daten, gewinnt sie automatisch — kein
 * Sonderfall nötig.
 *
 * Wichtig dabei: Alle Werte eines Tages stammen aus DERSELBEN Zeile. Schritte
 * von Google mit Kalorien von Polar zu mischen ergäbe Zahlen, die nicht
 * zueinander passen.
 *
 * Beide Zeilen bleiben gespeichert, entschieden wird beim Lesen. Damit ist die
 * Regel jederzeit änderbar, ohne Daten neu zu holen.
 */

import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

/** Schrittzahl eines Tages: `steps`, ersatzweise `activeSteps`. */
const stepValue = sql<number>`COALESCE(${dailyActivity.steps}, ${dailyActivity.activeSteps}, 0)`;

/**
 * Rangfolge innerhalb eines Tages. Die höhere Schrittzahl gewinnt; bei
 * Gleichstand die zuletzt aktualisierte Zeile, damit das Ergebnis stabil ist
 * und nicht von der Einfügereihenfolge abhängt.
 */
const winnerOrder = [desc(stepValue), desc(dailyActivity.updatedAt)];

function dateRange(from?: string, to?: string): SQL[] {
  const parts: SQL[] = [];
  if (from) parts.push(gte(dailyActivity.date, from));
  if (to) parts.push(lte(dailyActivity.date, to));
  return parts;
}

export type DailyRow = typeof dailyActivity.$inferSelect;

/**
 * Die gewinnende Zeile pro Tag, aufsteigend nach Datum.
 *
 * DISTINCT ON verlangt, dass die Sortierung mit den Gruppierungsspalten
 * beginnt — daher `date` zuerst, danach die Rangfolge.
 */
export async function winningDailyRows(
  userId: string,
  opts: { from?: string; to?: string } = {}
): Promise<DailyRow[]> {
  const rows = await db
    .selectDistinctOn([dailyActivity.date])
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, userId), ...dateRange(opts.from, opts.to)))
    .orderBy(asc(dailyActivity.date), ...winnerOrder);
  return rows;
}

/** Die gewinnende Zeile eines einzelnen Tages. */
export async function winningDailyRow(
  userId: string,
  date: string
): Promise<DailyRow | null> {
  const [row] = await db
    .select()
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.date, date)))
    .orderBy(...winnerOrder)
    .limit(1);
  return row ?? null;
}

/** Alle Tage mit Daten, neueste zuerst. Für die Datumsauswahl auf /daily. */
export async function availableDailyDates(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: dailyActivity.date })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .orderBy(desc(dailyActivity.date));
  return rows.map((r) => r.date);
}

/**
 * Tage, an denen die Schrittschwelle erreicht wurde.
 *
 * Für Streak und Kalender. Der Merge ist hier kein Detail: Ohne ihn käme ein
 * Tag doppelt in die Liste, sobald beide Uhren im Spiel waren — und ein Tag,
 * an dem nur die zweite Quelle über der Schwelle liegt, würde je nach
 * getroffener Zeile fehlen.
 */
export async function daysReachingSteps(
  userId: string,
  threshold: number,
  opts: { from?: string; to?: string } = {}
): Promise<{ date: string; steps: number }[]> {
  const rows = await db
    .select({ date: dailyActivity.date, steps: sql<number>`MAX(${stepValue})` })
    .from(dailyActivity)
    .where(and(eq(dailyActivity.userId, userId), ...dateRange(opts.from, opts.to)))
    .groupBy(dailyActivity.date)
    .having(sql`MAX(${stepValue}) >= ${threshold}`);
  return rows.map((r) => ({ date: r.date, steps: Number(r.steps) || 0 }));
}

/** Schritte pro Tag, neueste zuerst. Für die Kachel auf der Startseite. */
export async function recentStepDays(
  userId: string,
  limit: number
): Promise<{ date: string; steps: number }[]> {
  const rows = await db
    .select({ date: dailyActivity.date, steps: sql<number>`MAX(${stepValue})` })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .groupBy(dailyActivity.date)
    .orderBy(desc(dailyActivity.date))
    .limit(limit);
  return rows.map((r) => ({ date: r.date, steps: Number(r.steps) || 0 }));
}
