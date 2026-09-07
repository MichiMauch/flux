/**
 * Prueft die Leseschicht fuer Tagesdaten gegen die Datenbank.
 *
 *   tsx --env-file=.env.local scripts/check-daily-merge.ts [email]
 *
 * Zwei Dinge werden gezeigt:
 *
 *  1. Solange nur EINE Quelle pro Tag existiert, liefert die Leseschicht exakt
 *     dieselben Zeilen wie ein Direktzugriff. Das ist die Regressionsprobe fuer
 *     den Umbau der sechs Lesestellen.
 *  2. Wie die Regel bei Tagen mit ZWEI Quellen entscheidet — simuliert, ohne
 *     etwas zu schreiben, damit man das Verhalten sieht, bevor die Pixel Watch
 *     echte Tagesdaten liefert.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, dailyActivity } from "../src/lib/db/schema";
import {
  winningDailyRows,
  winningDailyRow,
  daysReachingSteps,
  recentStepDays,
  availableDailyDates,
} from "../src/lib/daily-activity-query";

const STEPS_THRESHOLD = 10_000;

async function main() {
  const email = process.argv[2] ?? "michi.mauch@gmail.com";
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error(`Kein User mit E-Mail ${email}`);

  // ── Rohbestand ──
  const raw = await db
    .select({
      date: dailyActivity.date,
      source: dailyActivity.source,
      steps: sql<number>`COALESCE(${dailyActivity.steps}, ${dailyActivity.activeSteps}, 0)`,
    })
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, user.id));

  const perDate = new Map<string, { source: string; steps: number }[]>();
  for (const r of raw) {
    const list = perDate.get(r.date) ?? [];
    list.push({ source: r.source, steps: Number(r.steps) });
    perDate.set(r.date, list);
  }
  const mehrfach = [...perDate.entries()].filter(([, v]) => v.length > 1);

  console.log(`\nRohzeilen        : ${raw.length}`);
  console.log(`Verschiedene Tage: ${perDate.size}`);
  console.log(`Tage mit 2 Quellen: ${mehrfach.length}`);
  const quellen = new Set(raw.map((r) => r.source));
  console.log(`Quellen          : ${[...quellen].join(", ")}`);

  // ── Erwartung selbst berechnen und gegen die Leseschicht halten ──
  const erwarteteSieger = new Map<string, number>();
  for (const [date, list] of perDate) {
    erwarteteSieger.set(date, Math.max(...list.map((l) => l.steps)));
  }

  const gewinner = await winningDailyRows(user.id);
  const dates = await availableDailyDates(user.id);
  const schwelle = await daysReachingSteps(user.id, STEPS_THRESHOLD);
  const letzte7 = await recentStepDays(user.id, 7);

  const erwarteteSchwelle = [...erwarteteSieger.entries()]
    .filter(([, s]) => s >= STEPS_THRESHOLD)
    .map(([d]) => d)
    .sort();

  let stepsMismatch = 0;
  for (const row of gewinner) {
    const soll = erwarteteSieger.get(row.date) ?? 0;
    const ist = row.steps ?? row.activeSteps ?? 0;
    if (ist !== soll) stepsMismatch++;
  }

  const checks: [string, boolean, string][] = [
    ["genau eine Zeile pro Tag", gewinner.length === perDate.size, `${gewinner.length} von ${perDate.size}`],
    ["Sieger hat die hoechste Schrittzahl", stepsMismatch === 0, `${stepsMismatch} Abweichung(en)`],
    ["Datumsliste vollstaendig", dates.length === perDate.size, `${dates.length} Daten`],
    ["Datumsliste absteigend", dates.every((d, i) => i === 0 || dates[i - 1] >= d), dates[0] ?? "-"],
    [
      "Schwellentage stimmen",
      schwelle.length === erwarteteSchwelle.length &&
        schwelle.map((s) => s.date).sort().every((d, i) => d === erwarteteSchwelle[i]),
      `${schwelle.length} statt ${erwarteteSchwelle.length}`,
    ],
    ["Schwellentage ohne Dubletten", new Set(schwelle.map((s) => s.date)).size === schwelle.length, ""],
    ["letzte 7 Tage eindeutig", new Set(letzte7.map((r) => r.date)).size === letzte7.length, `${letzte7.length} Zeilen`],
  ];

  // Einzelabruf gegen den Sieger aus der Liste halten.
  const probe = gewinner[gewinner.length - 1];
  if (probe) {
    const einzeln = await winningDailyRow(user.id, probe.date);
    checks.push([
      "Einzelabruf == Listenabruf",
      einzeln?.id === probe.id,
      `${probe.date}`,
    ]);
  }

  console.log("");
  let failed = 0;
  for (const [label, ok, detail] of checks) {
    console.log(`  ${ok ? "✓" : "✗"} ${label.padEnd(36)} ${detail}`);
    if (!ok) failed++;
  }

  if (mehrfach.length > 0) {
    console.log("\n  Tage mit zwei Quellen und die getroffene Wahl:");
    for (const [date, list] of mehrfach.slice(0, 10)) {
      const sieger = await winningDailyRow(user.id, date);
      const beschreibung = list.map((l) => `${l.source}=${l.steps}`).join(" / ");
      console.log(`    ${date}  ${beschreibung}  →  ${sieger?.source} (${sieger?.steps ?? sieger?.activeSteps})`);
    }
  } else {
    console.log("\n  (Noch kein Tag mit zwei Quellen — die Merge-Regel greift erst,");
    console.log("   sobald Google Tagesdaten liefert.)");
  }

  if (process.argv.includes("--simulate")) {
    failed += await simulateTwoSourceDay(user.id);
  }

  console.log(failed === 0 ? "\nAlles gruen." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
  await db.$client.end();
  if (failed > 0) process.exit(1);
}

/**
 * Legt fuer einen weit zurueckliegenden Testtag zwei Zeilen an, prueft die
 * Entscheidung und raeumt in jedem Fall wieder auf.
 *
 * Noetig, weil ein echter Tag mit zwei Quellen erst entsteht, wenn beide Uhren
 * am selben Tag getragen werden. Ohne diese Probe bliebe die Kernregel
 * ungetestet, bis sie das erste Mal produktiv greift.
 */
async function simulateTwoSourceDay(userId: string): Promise<number> {
  const TEST_DATE = "1990-01-01";
  console.log(`\n  Simulation mit Testtag ${TEST_DATE}:`);
  let failed = 0;

  try {
    await db.insert(dailyActivity).values([
      { userId, date: TEST_DATE, source: "polar", steps: 4200, calories: 1800, distance: 3000 },
      { userId, date: TEST_DATE, source: "google", steps: 9100, calories: 2400, distance: 6800 },
    ]);

    const sieger = await winningDailyRow(userId, TEST_DATE);
    const proben: [string, boolean, string][] = [
      ["hoehere Schrittzahl gewinnt", sieger?.source === "google", `${sieger?.source} mit ${sieger?.steps}`],
      [
        "Werte aus DERSELBEN Zeile",
        sieger?.calories === 2400 && sieger?.distance === 6800,
        `${sieger?.calories} kcal / ${sieger?.distance} m`,
      ],
      [
        "Tag zaehlt genau einmal",
        (await winningDailyRows(userId, { from: TEST_DATE, to: TEST_DATE })).length === 1,
        "",
      ],
      [
        "Schwelle nutzt den Sieger",
        (await daysReachingSteps(userId, 9000, { from: TEST_DATE, to: TEST_DATE })).length === 1,
        "9000 Schritte",
      ],
      [
        "unter der Schwelle nicht gezaehlt",
        (await daysReachingSteps(userId, 9500, { from: TEST_DATE, to: TEST_DATE })).length === 0,
        "9500 Schritte",
      ],
    ];
    for (const [label, ok, detail] of proben) {
      console.log(`    ${ok ? "✓" : "✗"} ${label.padEnd(32)} ${detail}`);
      if (!ok) failed++;
    }
  } finally {
    const geloescht = await db
      .delete(dailyActivity)
      .where(and(eq(dailyActivity.userId, userId), eq(dailyActivity.date, TEST_DATE)))
      .returning({ id: dailyActivity.id });
    console.log(`    (Testtag entfernt, ${geloescht.length} Zeilen)`);
  }
  return failed;
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  process.exit(1);
});
