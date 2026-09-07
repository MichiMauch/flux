/**
 * Aktivitäten aus der Google Health API nach flux importieren.
 *
 *   tsx --env-file=.env.local scripts/import-google-activity.ts \
 *     --email=<user-email> \
 *     --token-file=<pfad-zur-token-json> \
 *     [--since=YYYY-MM-DD] [--dry-run] [--yes]
 *
 * Übergangswerkzeug, bis die richtige Anbindung steht (flux-mpe, flux-ys4).
 * Es holt sich den Zugriff über einen bereits erzeugten Refresh-Token statt
 * über einen OAuth-Flow in der App, schreibt aber schon mit denselben Regeln,
 * die der spätere Sync anwendet:
 *
 *   - nur Aufzeichnungen der UHR (dataSource.device.formFactor === "WATCH");
 *     was das Handy erfasst hat, bleibt draussen
 *   - nur recordingMethod === "ACTIVELY_MEASURED", also bewusst gestartet
 *   - GPS ist KEIN Kriterium: Yoga von der Uhr hat nie welches und soll rein
 *
 * Alles, was aussortiert wird, steht mit Grund in der Ausgabe — daran lässt
 * sich ablesen, ob die Regel zu streng ist.
 *
 * Eingefügt wird mit polar_id = "google:<dataPointId>" und source = "google".
 * Die UNIQUE-Bedingung auf polar_id macht wiederholte Läufe zum No-Op.
 */

import { parseArgs } from "node:util";
import * as readline from "node:readline/promises";
import { readFileSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, activities, deletedPolarActivities } from "../src/lib/db/schema";
import { parseTcxFile, reconcileGoogleAscent } from "../src/lib/tcx-parser";
import { normalizeGoogleType } from "../src/lib/google-sport-map";
import { computeTrimp, type Sex } from "../src/lib/trimp";
import { generateActivityTitle } from "../src/lib/ai-title";
import { buildRouteGeometry } from "../src/lib/activities/route-geometry";
import { reverseGeocodeStructured } from "../src/lib/geocode";
import { activityTypeLabel } from "../src/lib/activity-types";
import { APP_TIME_ZONE } from "../src/lib/activity-format";

const API = "https://health.googleapis.com/v4";

interface GoogleExercisePoint {
  name: string;
  dataSource?: {
    recordingMethod?: string;
    platform?: string;
    device?: { formFactor?: string; displayName?: string };
  };
  exercise?: {
    interval?: {
      startTime?: string;
      endTime?: string;
      startUtcOffset?: string;
    };
    exerciseType?: string;
    displayName?: string;
    activeDuration?: string;
    exerciseMetadata?: { hasGps?: boolean };
    metricsSummary?: {
      caloriesKcal?: number;
      distanceMillimeters?: string | number;
      steps?: string | number;
      averageHeartRateBeatsPerMinute?: string | number;
      elevationGainMillimeters?: string | number;
      activeZoneMinutes?: string | number;
    };
  };
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      "token-file": { type: "string" },
      since: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
      "archive-tcx": { type: "boolean", default: false },
    },
  });
  if (!values.email) throw new Error("--email fehlt");
  if (!values["token-file"]) throw new Error("--token-file fehlt");
  return {
    email: values.email,
    tokenFile: values["token-file"],
    since: values.since ?? null,
    dryRun: values["dry-run"] ?? false,
    yes: values.yes ?? false,
    archiveTcx: values["archive-tcx"] ?? false,
  };
}

async function accessToken(tokenFile: string): Promise<string> {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_HEALTH_CLIENT_ID / GOOGLE_HEALTH_CLIENT_SECRET fehlen");
  }
  const saved = JSON.parse(readFileSync(tokenFile, "utf8"));
  if (!saved.refresh_token) throw new Error(`Kein refresh_token in ${tokenFile}`);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: saved.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token-Refresh fehlgeschlagen: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

/** ISO-8601-Dauer im Google-Stil ("1545s") in Sekunden. */
function durationSec(v: string | undefined): number {
  if (!v) return 0;
  const m = v.match(/^([\d.]+)s$/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function toNum(v: string | number | undefined | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtDate(d: Date): string {
  return d.toLocaleString("de-CH", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMeters(m: number | null): string {
  return m == null ? "—" : m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

/** Warum eine Aktivität nicht importiert wird, oder null wenn sie darf. */
function rejectReason(p: GoogleExercisePoint, since: Date | null): string | null {
  const ds = p.dataSource;
  const form = ds?.device?.formFactor;
  if (form !== "WATCH") {
    return `nicht von der Uhr (formFactor=${form ?? "unbekannt"}${
      ds?.device?.displayName ? `, ${ds.device.displayName}` : ""
    })`;
  }
  if (ds?.recordingMethod !== "ACTIVELY_MEASURED") {
    return `nicht bewusst gestartet (recordingMethod=${ds?.recordingMethod ?? "unbekannt"})`;
  }
  const start = p.exercise?.interval?.startTime;
  if (!start) return "kein Startzeitpunkt";
  if (since && new Date(start) < since) {
    return `vor dem Stichtag (${start.slice(0, 10)})`;
  }
  return null;
}

async function main() {
  const args = parseCliArgs();
  const since = args.since ? new Date(`${args.since}T00:00:00Z`) : null;

  const user = await db.query.users.findFirst({
    where: eq(users.email, args.email),
  });
  if (!user) throw new Error(`Kein User mit E-Mail ${args.email}`);
  console.log(`User: ${user.name ?? user.email} (${user.id})`);
  if (since) console.log(`Stichtag: nichts vor ${args.since}`);
  if (args.dryRun) console.log("Modus: DRY RUN, es wird nichts geschrieben");
  console.log("");

  const token = await accessToken(args.tokenFile);

  const listRes = await fetch(
    `${API}/users/me/dataTypes/exercise/dataPoints?pageSize=25`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
  );
  const listBody = await listRes.json();
  if (!listRes.ok) {
    throw new Error(`Abruf fehlgeschlagen: ${JSON.stringify(listBody).slice(0, 400)}`);
  }
  const points: GoogleExercisePoint[] = listBody.dataPoints ?? [];
  console.log(`Google liefert ${points.length} Aktivitäten\n`);

  const candidates: GoogleExercisePoint[] = [];
  for (const p of points) {
    const start = p.exercise?.interval?.startTime;
    const label = `${start ? start.slice(0, 16).replace("T", " ") : "?"}  ${
      p.exercise?.exerciseType ?? "?"
    }`;
    const reason = rejectReason(p, since);
    if (reason) {
      console.log(`  – ${label}  übersprungen: ${reason}`);
      continue;
    }
    candidates.push(p);
    console.log(`  + ${label}  Kandidat`);
  }

  if (candidates.length === 0) {
    console.log("\nNichts zu importieren.");
    await db.$client.end();
    return;
  }

  let rl: readline.Interface | null = null;
  if (!args.yes && !args.dryRun) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  let imported = 0;
  let skippedExisting = 0;

  for (const p of candidates) {
    const dataPointId = p.name.split("/").pop()!;
    const externalId = `google:${dataPointId}`;
    const ex = p.exercise!;
    const iv = ex.interval!;
    const startTime = new Date(iv.startTime!);

    const existing = await db.query.activities.findFirst({
      where: eq(activities.polarId, externalId),
    });
    if (existing) {
      console.log(`\n  ${externalId}: schon importiert, übersprungen`);
      skippedExisting++;
      continue;
    }
    const blacklisted = await db.query.deletedPolarActivities.findFirst({
      where: and(
        eq(deletedPolarActivities.polarId, externalId),
        eq(deletedPolarActivities.userId, user.id),
      ),
    });
    if (blacklisted) {
      console.log(`\n  ${externalId}: in flux gelöscht, nicht erneut importieren`);
      skippedExisting++;
      continue;
    }

    console.log(`\n  ${externalId}  ${fmtDate(startTime)}`);

    // ── Track holen ──────────────────────────────────────────────────────
    let parsed: ReturnType<typeof parseTcxFile> | null = null;
    let tcxPath: string | null = null;
    if (ex.exerciseMetadata?.hasGps) {
      const tcxRes = await fetch(`${API}/${p.name}:exportExerciseTcx?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tcxRes.ok) {
        const tcx = await tcxRes.text();
        parsed = parseTcxFile(tcx);
        console.log(
          `    TCX: ${parsed.routeData.length} Punkte, ${parsed.heartRateData.length} Pulswerte`,
        );
        // Standardmässig NICHT archivieren. Das Skript läuft auf dem Arbeitsrechner,
        // die Datenbank steht auf dem Server — ein hier geschriebener Pfad zeigt in
        // Produktion ins Leere. Der Track liegt ohnehin vollständig in route_data,
        // es geht also nichts verloren. Mit --archive-tcx lässt es sich einschalten,
        // etwa wenn das Skript einmal auf dem Server selbst läuft.
        if (args.archiveTcx) {
          try {
            const dir = join(process.env.FIT_FILES_PATH || "/data/fit-files", user.id);
            await mkdir(dir, { recursive: true });
            tcxPath = join(dir, `${dataPointId}.tcx`);
            await writeFile(tcxPath, tcx);
          } catch {
            tcxPath = null;
            console.log("    (TCX nicht archiviert, Verzeichnis nicht beschreibbar)");
          }
        }
      } else {
        console.log(`    ⚠ TCX-Abruf fehlgeschlagen: HTTP ${tcxRes.status}`);
      }
    } else {
      console.log("    kein GPS (z.B. Indoor) — nur Summenwerte");
    }

    // ── Werte zusammenführen: Summary schlägt Track, wo beides existiert ──
    const sum = ex.metricsSummary ?? {};
    const { type, known } = normalizeGoogleType(ex.exerciseType, ex.displayName);
    if (!known) {
      console.log(
        `    ⚠ exerciseType "${ex.exerciseType}" nicht bestätigt, per Heuristik auf ${type} abgebildet`,
      );
    }

    const distanceMm = toNum(sum.distanceMillimeters);
    const distance = distanceMm != null ? distanceMm / 1000 : (parsed?.session?.totalDistance ?? null);
    const elapsed = Math.round((new Date(iv.endTime!).getTime() - startTime.getTime()) / 1000);
    const moving = durationSec(ex.activeDuration) || parsed?.session?.movingTime || null;
    const avgHr = toNum(sum.averageHeartRateBeatsPerMinute) ?? parsed?.session?.avgHeartRate ?? null;
    // Max-Puls liefert Google nicht — er kommt ausschliesslich aus dem Track.
    const maxHr = parsed?.session?.maxHeartRate ?? null;
    const ascent = reconcileGoogleAscent(
      toNum(sum.elevationGainMillimeters),
      parsed?.session?.totalAscent ?? null,
      { distanceMeters: distance, type },
    );

    const trimp = computeTrimp(
      {
        sex: user.sex as Sex,
        birthday: user.birthday,
        maxHeartRate: user.maxHeartRate,
        restHeartRate: user.restHeartRate,
      },
      { avgHeartRate: avgHr, maxHeartRate: maxHr, duration: moving ?? elapsed },
      parsed?.heartRateData ?? null,
    );

    // ── Ort ──────────────────────────────────────────────────────────────
    let locality: string | null = null;
    let country: string | null = null;
    let geocodedAt: Date | null = null;
    const first = parsed?.routeData?.[0];
    if (first) {
      const loc = await reverseGeocodeStructured(first.lat, first.lng);
      if (loc) {
        locality = loc.locality;
        country = loc.country;
        geocodedAt = new Date();
        console.log(`    Ort: ${locality ?? "?"}${country ? `, ${country}` : ""}`);
      }
    }

    // ── Titel ────────────────────────────────────────────────────────────
    const fallbackTitle = ex.displayName?.trim() || activityTypeLabel(type);
    let name = fallbackTitle;
    try {
      name = await generateActivityTitle({
        type,
        subType: ex.displayName ?? null,
        startTime,
        distanceMeters: distance,
        durationSeconds: moving ?? elapsed,
        ascentMeters: ascent,
        routeData: parsed?.routeData ?? null,
        fallbackTitle,
      });
    } catch (e) {
      console.warn(`    ⚠ Titelgenerierung fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    }

    const row = {
      polarId: externalId,
      source: "google",
      userId: user.id,
      name,
      type,
      startTime,
      duration: elapsed,
      movingTime: moving,
      distance,
      calories: toNum(sum.caloriesKcal),
      avgHeartRate: avgHr,
      maxHeartRate: maxHr,
      ascent,
      descent: parsed?.session?.totalDescent ?? null,
      routeData: parsed?.routeData ?? null,
      routeGeometry: buildRouteGeometry(parsed?.routeData ?? null),
      heartRateData: parsed?.heartRateData ?? null,
      speedData: parsed?.speedData ?? null,
      minAltitude: parsed?.session?.minAltitude ?? null,
      maxAltitude: parsed?.session?.maxAltitude ?? null,
      // Trittfrequenz und Schritte pro Aktivität liefert Googles TCX nicht.
      totalSteps: toNum(sum.steps),
      avgSpeed: parsed?.session?.avgSpeed ?? null,
      maxSpeed: parsed?.session?.maxSpeed ?? null,
      trimp,
      device: p.dataSource?.device?.displayName ?? null,
      fitFilePath: tcxPath,
      locality,
      country,
      geocodedAt,
    };

    console.log(
      `    → ${activityTypeLabel(type)} "${name}"  ${fmtMeters(distance)}  ` +
        `${Math.round((moving ?? elapsed) / 60)} min  ⌀${avgHr ?? "—"} / max ${maxHr ?? "—"} bpm  ` +
        `${ascent != null ? `${Math.round(ascent)} Hm` : "— Hm"}  trimp=${trimp ?? "—"}`,
    );

    if (args.dryRun) {
      console.log("    (Dry Run, nicht geschrieben)");
      imported++;
      continue;
    }

    if (rl) {
      const answer = (await rl.question("    Importieren? [j/N] ")).trim().toLowerCase();
      if (answer !== "j" && answer !== "y") {
        console.log("    übersprungen");
        continue;
      }
    }

    await db.insert(activities).values(row);
    console.log("    ✓ importiert");
    imported++;
  }

  rl?.close();

  console.log("\n════════════════════════════════════════");
  console.log(`Von Google geholt : ${points.length}`);
  console.log(`Kandidaten        : ${candidates.length}`);
  console.log(`Importiert        : ${imported}${args.dryRun ? " (Dry Run)" : ""}`);
  console.log(`Schon vorhanden   : ${skippedExisting}`);

  await db.$client.end();
}

main().catch((e) => {
  console.error("\nAbbruch:", e instanceof Error ? e.message : e);
  // Drizzle verpackt Datenbankfehler und zeigt nur das gescheiterte Statement.
  // Die eigentliche Ursache (fehlende Spalte, Verbindung, Constraint) steckt in
  // cause und ist ohne diese Zeilen nicht zu sehen.
  const cause = (e as { cause?: unknown })?.cause;
  if (cause) console.error("Ursache:", cause);
  process.exit(1);
});
