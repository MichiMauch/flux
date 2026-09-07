/**
 * Zeigt, wie die Importregel auf die tatsaechlich vorhandenen Google-Aktivitaeten
 * wirkt — ohne irgendetwas zu schreiben.
 *
 *   tsx --env-file=.env.local scripts/check-google-filter.ts [--days=30] [--email=...]
 *
 * Gedacht zum Nachjustieren der Regel: sie laesst derzeit nur zu, was auf der
 * Uhr aufgezeichnet UND bewusst gestartet wurde. Ob von der Uhr selbst erkannte
 * Aktivitaeten einen anderen recordingMethod tragen, liess sich bisher nicht
 * klaeren — hier wird es sichtbar, sobald so ein Fall auftritt.
 */

import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, activities } from "../src/lib/db/schema";
import {
  getValidAccessToken,
  listExercises,
  rejectImportReason,
  dataPointId,
  parseGoogleDuration,
} from "../src/lib/google-health-client";

async function main() {
  const { values } = parseArgs({
    options: {
      days: { type: "string", default: "30" },
      email: { type: "string", default: "michi.mauch@gmail.com" },
    },
  });
  const days = Number(values.days);

  const user = await db.query.users.findFirst({ where: eq(users.email, values.email!) });
  if (!user) throw new Error(`Kein User mit E-Mail ${values.email}`);
  if (!user.googleRefreshToken) throw new Error("Google nicht verbunden");

  const token = await getValidAccessToken(user);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const points = await listExercises(token, since);

  console.log(`\nStichtag des Users : ${user.googleConnectedAt?.toISOString() ?? "keiner"}`);
  console.log(`Abfrage ab         : ${since.toISOString().slice(0, 10)} (${days} Tage)`);
  console.log(`Google liefert     : ${points.length} Aktivitaeten\n`);

  for (const p of points) {
    const id = dataPointId(p.name);
    const ex = p.exercise;
    const start = ex?.interval?.startTime?.slice(0, 16).replace("T", " ") ?? "?";
    const ds = p.dataSource;
    const quelle = `${ds?.device?.formFactor ?? "?"}/${ds?.recordingMethod ?? "?"}${
      ds?.device?.displayName ? `/${ds.device.displayName}` : ""
    }`;

    // Zwei getrennte Urteile: was die Regel allgemein sagt, und was der
    // tatsaechliche Stichtag des Users daraus macht.
    const ohneStichtag = rejectImportReason(p, null);
    const mitStichtag = rejectImportReason(p, user.googleConnectedAt ?? null);

    const vorhanden = await db.query.activities.findFirst({
      where: eq(activities.polarId, `google:${id}`),
    });

    const urteil = ohneStichtag
      ? `✗ ${ohneStichtag}`
      : vorhanden
        ? "• bereits in flux"
        : mitStichtag
          ? `– ${mitStichtag}`
          : "✓ wuerde importiert";

    console.log(
      `  ${start}  ${String(ex?.exerciseType ?? "?").padEnd(10)} ` +
        `${`${Math.round(parseGoogleDuration(ex?.activeDuration) / 60)} min`.padEnd(7)} ` +
        `gps=${ex?.exerciseMetadata?.hasGps ? "ja " : "nein"}  ${quelle.padEnd(42)} ${urteil}`,
    );
  }

  console.log("");
  await db.$client.end();
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  process.exit(1);
});
