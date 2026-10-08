/**
 * Eine lückenhafte Google-Aufzeichnung mit einer GPX-Strecke zusammensetzen.
 *
 * Anlass: Die Pixel Watch pausierte am 8.10.2026 mitten in einer Wanderung.
 * Der Track bestand aus dem ersten Teil, einem geraden Sprung über 3 km und
 * den letzten Metern. Die ganze Strecke lag als GPX vor (ohne Zeit und Höhe).
 *
 * Zusammengesetzt wird:
 *   Teil 1   Google-Track bis zur Lücke, unverändert (Zeit, Puls, Tempo)
 *   Lücke    GPX-Punkte zwischen den beiden Anschlussstellen; Zeitstempel
 *            gleichmässig nach Distanz über die Pausendauer verteilt, Höhe von
 *            swisstopo, Tempo konstant. Kein Puls — der wurde nicht gemessen
 *            und wird nicht erfunden.
 *   Ende     Google-Track nach der Lücke; die Höhe kommt ebenfalls von
 *            swisstopo, weil das Barometer der Uhr während der Pause stehen
 *            blieb und danach rund 100 m daneben lag.
 *
 * Startzeit und Ende bleiben die von Google. Kalorien und Schritte misst die
 * Uhr nur in der aufgezeichneten Zeit; sie werden auf die ganze Tour
 * hochgerechnet — Kalorien über die Dauer, Schritte über die Distanz. Der
 * Durchschnittspuls bleibt der gemessene.
 *
 * Geschrieben wird unter polar_id "google:<id>", damit der Sync die Aufzeichnung
 * als vorhanden erkennt. Existiert die Zeile schon, wird sie ersetzt.
 *
 *   tsx --env-file=.env.local scripts/merge-google-gpx.ts \
 *     --id=<dataPointId> --gpx=<datei> --day=YYYY-MM-DD [--name="…"] [--apply]
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, activities } from "../src/lib/db/schema";
import {
  getValidAccessToken,
  listExercises,
  exportExerciseTcx,
  dataPointId,
} from "../src/lib/google-health-client";
import { parseTcxFile } from "../src/lib/tcx-parser";
import { normalizeGoogleType } from "../src/lib/google-sport-map";
import { enrichActivity, type ActivityDraft } from "../src/lib/activities/ingest";
import { computeElevationStats, type RoutePoint } from "../src/lib/activity-stats";
import {
  findElevationAnchor,
  swisstopoHeights,
} from "../src/lib/elevation-anchor";

type Pt = { lat: number; lng: number; time?: string; elevation?: number };

// Ab dieser Dauer zwischen zwei Trackpunkten gilt es als Aufzeichnungslücke.
const GAP_MIN_SEC = 300;
// Abstand der eingefügten Punkte. Das GPX hat rund 30 m zwischen den Punkten;
// dichter interpoliert wird das Höhenprofil glatt statt stufig.
const FILL_SPACING_M = 15;
// Tempo-Stützpunkte in der Lücke, im selben Takt wie der TCX-Parser.
const FILL_SPEED_STEP_SEC = 3;

function hav(a: Pt, b: Pt): number {
  const R = 6371000;
  const r = Math.PI / 180;
  const dp = (b.lat - a.lat) * r;
  const dl = (b.lng - a.lng) * r;
  const h =
    Math.sin(dp / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLength(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += hav(pts[i - 1], pts[i]);
  return d;
}

function nearestIndex(target: Pt, pts: Pt[], from = 0): number {
  let best = from;
  let bestD = Infinity;
  for (let i = from; i < pts.length; i++) {
    const d = hav(target, pts[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Punkte entlang der Linie einfügen, bis kein Abstand über `spacing` bleibt. */
function densify(pts: Pt[], spacing: number): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.ceil(hav(a, b) / spacing);
    for (let k = 1; k <= n; k++) {
      const f = k / n;
      out.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f });
    }
  }
  return out;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      gpx: { type: "string" },
      day: { type: "string" },
      name: { type: "string" },
      email: { type: "string", default: "michi.mauch@gmail.com" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.id || !values.gpx || !values.day) {
    throw new Error("--id, --gpx und --day sind Pflicht");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, values.email!),
  });
  if (!user) throw new Error(`User ${values.email} nicht gefunden`);

  // ── Google-Aufzeichnung holen ───────────────────────────────────────────
  const token = await getValidAccessToken(user);
  const points = await listExercises(token, new Date(`${values.day}T00:00:00Z`));
  const p = points.find((x) => dataPointId(x.name) === values.id);
  if (!p?.exercise?.interval) throw new Error(`Aufzeichnung ${values.id} nicht gefunden`);
  const ex = p.exercise;
  const parsed = parseTcxFile(await exportExerciseTcx(token, p.name));
  const track = parsed.routeData as Pt[];

  // ── Lücke finden ────────────────────────────────────────────────────────
  let gapAt = -1;
  let gapSec = 0;
  for (let i = 1; i < track.length; i++) {
    const dt = (Date.parse(track[i].time!) - Date.parse(track[i - 1].time!)) / 1000;
    if (dt > gapSec) {
      gapSec = dt;
      gapAt = i;
    }
  }
  if (gapAt < 0 || gapSec < GAP_MIN_SEC) {
    throw new Error(`Keine Lücke über ${GAP_MIN_SEC} s gefunden (grösste: ${gapSec} s)`);
  }
  const part1 = track.slice(0, gapAt);
  const part2 = track.slice(gapAt);
  const end1 = part1[part1.length - 1];
  const start2 = part2[0];
  console.log(
    `Teil 1: ${part1.length} Punkte bis ${end1.time}\n` +
      `Lücke : ${Math.round(gapSec)} s, Luftlinie ${Math.round(hav(end1, start2))} m\n` +
      `Ende  : ${part2.length} Punkte ab ${start2.time}`
  );

  // ── GPX-Abschnitt für die Lücke ─────────────────────────────────────────
  const gpx: Pt[] = [
    ...readFileSync(values.gpx, "utf8").matchAll(/<trkpt lat="([\d.-]+)" lon="([\d.-]+)"/g),
  ].map((m) => ({ lat: Number(m[1]), lng: Number(m[2]) }));
  if (gpx.length < 2) throw new Error("GPX enthält keine Trackpunkte");

  // Anschluss nach Teil 1: der nächste GPX-Punkt. Anschluss vor dem Ende: der
  // nächste GPX-Punkt DAHINTER — eine Rundtour kommt am Schluss wieder an
  // Punkten vom Anfang vorbei, die sonst gewinnen würden.
  const a = nearestIndex(end1, gpx);
  const b = nearestIndex(start2, gpx, a + 1);
  console.log(
    `GPX   : ${gpx.length} Punkte, Anschluss bei Index ${a} (${Math.round(hav(end1, gpx[a]))} m neben Teil 1)` +
      ` bis ${b} (${Math.round(hav(start2, gpx[b]))} m neben dem Ende)`
  );
  const bridge = densify([end1, ...gpx.slice(a + 1, b), start2], FILL_SPACING_M);
  const bridgeLen = pathLength(bridge);

  // Zeit nach zurückgelegter Distanz über die Pause verteilen.
  const t0 = Date.parse(end1.time!);
  const t1 = Date.parse(start2.time!);
  let run = 0;
  const fill: Pt[] = [];
  for (let i = 1; i < bridge.length - 1; i++) {
    run += hav(bridge[i - 1], bridge[i]);
    fill.push({
      lat: bridge[i].lat,
      lng: bridge[i].lng,
      time: new Date(t0 + ((t1 - t0) * run) / bridgeLen).toISOString(),
    });
  }
  const fillSpeed = (bridgeLen / ((t1 - t0) / 1000)) * 3.6;
  console.log(
    `Füllung: ${fill.length} Punkte, ${Math.round(bridgeLen)} m, ${fillSpeed.toFixed(1)} km/h`
  );

  // ── Höhen ───────────────────────────────────────────────────────────────
  // Teil 1: relative Höhe der Uhr um den Versatz zum Höhenmodell verschieben.
  const anchor = await findElevationAnchor(part1);
  if (!anchor) throw new Error("Höhenabgleich für Teil 1 fehlgeschlagen");
  const offset = round1(anchor.offset);
  const part1Abs = part1.map((q) =>
    typeof q.elevation === "number" ? { ...q, elevation: round1(q.elevation + offset) } : q
  );
  // Füllung und Ende: direkt aus dem Höhenmodell.
  const dem = await swisstopoHeights([...fill, ...part2]);
  const missing = dem.filter((h) => h == null).length;
  if (missing > 0) throw new Error(`swisstopo lieferte für ${missing} Punkte keine Höhe`);
  const withDem = [...fill, ...part2].map((q, i) => ({ ...q, elevation: round1(dem[i]!) }));
  const routeData = [...part1Abs, ...withDem];
  console.log(
    `Höhe  : Teil 1 +${offset} m (${anchor.source}), ${withDem.length} Punkte aus swisstopo;` +
      ` Übergang ${part1Abs[part1Abs.length - 1].elevation} → ${withDem[0].elevation} m`
  );

  // ── Tempo ───────────────────────────────────────────────────────────────
  const fillSpeedData: { time: string; speed: number }[] = [];
  for (let t = t0 + FILL_SPEED_STEP_SEC * 1000; t < t1; t += FILL_SPEED_STEP_SEC * 1000) {
    fillSpeedData.push({ time: new Date(t).toISOString(), speed: fillSpeed });
  }
  const speedData = [
    ...parsed.speedData.filter((s) => Date.parse(s.time) <= t0),
    ...fillSpeedData,
    ...parsed.speedData.filter((s) => Date.parse(s.time) >= t1),
  ];

  // ── Kennzahlen ──────────────────────────────────────────────────────────
  const sum = ex.metricsSummary ?? {};
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const startTime = new Date(ex.interval!.startTime!);
  const duration = Math.round(
    (new Date(ex.interval!.endTime!).getTime() - startTime.getTime()) / 1000
  );
  const recordedDistance =
    num(sum.distanceMillimeters) != null
      ? num(sum.distanceMillimeters)! / 1000
      : pathLength(part1) + pathLength(part2);
  const distance = recordedDistance + bridgeLen;
  // Aufgezeichnete Sekunden: alles ausser der Lücke.
  const recordedSec = duration - gapSec;
  const scale = (v: number | null, factor: number) =>
    v == null ? null : Math.round(v * factor);
  const elev = computeElevationStats(routeData as RoutePoint[]);
  const { type } = normalizeGoogleType(ex.exerciseType, ex.displayName);

  const draft: ActivityDraft = {
    source: "google",
    externalId: `google:${values.id}`,
    type,
    subType: ex.displayName ?? null,
    fallbackTitle: values.name ?? null,
    startTime,
    duration,
    // Die Pause der Uhr war keine Pause der Wanderung.
    movingTime: duration,
    distance,
    calories: scale(num(sum.caloriesKcal), duration / recordedSec),
    avgHeartRate:
      num(sum.averageHeartRateBeatsPerMinute) ?? parsed.session?.avgHeartRate ?? null,
    maxHeartRate: parsed.session?.maxHeartRate ?? null,
    ascent: elev.ascent,
    descent: elev.descent,
    minAltitude: elev.minAlt,
    maxAltitude: elev.maxAlt,
    avgCadence: null,
    maxCadence: null,
    totalSteps: scale(num(sum.steps), distance / recordedDistance),
    avgSpeed: (distance / duration) * 3.6,
    maxSpeed: parsed.session?.maxSpeed ?? null,
    routeData,
    heartRateData: parsed.heartRateData,
    speedData,
    device: p.dataSource?.device?.displayName ?? null,
    filePath: null,
  };

  console.log(
    `\nErgebnis: ${routeData.length} Punkte, ${(distance / 1000).toFixed(2)} km` +
      ` (aufgezeichnet ${(recordedDistance / 1000).toFixed(2)} + ergänzt ${(bridgeLen / 1000).toFixed(2)}),` +
      ` ${Math.floor(duration / 3600)}h ${Math.round((duration % 3600) / 60)}min,` +
      ` ↑${Math.round(elev.ascent ?? 0)} m ↓${Math.round(elev.descent ?? 0)} m,` +
      ` ${Math.round(elev.minAlt ?? 0)}–${Math.round(elev.maxAlt ?? 0)} m`
  );
  console.log(`Start ${startTime.toISOString()}, Ende ${routeData[routeData.length - 1].time}`);

  if (!values.apply) {
    console.log("\nDry-Run — nichts geschrieben. Mit --apply ausführen.");
    process.exit(0);
  }

  const row = await enrichActivity(user, draft);
  if (values.name) row.name = values.name;

  const existing = await db.query.activities.findFirst({
    where: eq(activities.polarId, draft.externalId!),
  });
  if (existing) {
    await db.update(activities).set(row).where(eq(activities.id, existing.id));
    console.log(`\n✓ Aktivität ${existing.id} ersetzt: ${row.name}`);
  } else {
    const [inserted] = await db
      .insert(activities)
      .values(row)
      .returning({ id: activities.id });
    console.log(`\n✓ Aktivität ${inserted.id} angelegt: ${row.name}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  process.exit(1);
});
