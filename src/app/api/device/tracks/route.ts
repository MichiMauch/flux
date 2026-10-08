import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { gunzipSync } from "zlib";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, activities, deletedPolarActivities } from "@/lib/db/schema";
import { enrichActivity } from "@/lib/activities/ingest";
import { insertActivity, finishIngest } from "@/lib/activities/ingest-effects";
import { parseTrailTrack, buildTrailDraft, trailExternalId } from "@/lib/trail-import";

/**
 * Annahme einer Wanderung aus flux-trail, der eigenen App auf der Pixel Watch.
 *
 * Die Uhr schickt den Track, sobald auf ihr «Speichern» gewählt wurde, und
 * wiederholt den Upload, bis hier eine Zusage kommt. Darum zwei Dinge:
 *
 * Idempotent über `flux-trail:<id>` in activities.polar_id. Ein zweiter Upload
 * derselben Wanderung schreibt nichts und meldet trotzdem Erfolg — sonst
 * versucht die Uhr es ewig weiter.
 *
 * Synchron. Die Zusage geht erst hinaus, wenn die Aktivität in der Datenbank
 * steht, auch wenn Titel und Ortsauflösung ein paar Sekunden kosten. Eine
 * Zusage vor dem Schreiben hiesse: Scheitert der Import danach, hält die Uhr
 * die Wanderung für abgeliefert, und sie ist weg.
 *
 * Die Route steht in `publicRoutes` (proxy.ts) und weist sich selbst aus, wie
 * die Webhooks. Ohne den Eintrag bekäme die Uhr eine Umleitung auf /login.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.FLUX_TRAIL_API_KEY;
  if (!expected) {
    console.error("FLUX_TRAIL_API_KEY not configured — rejecting upload");
    return NextResponse.json({ error: "Upload not configured" }, { status: 500 });
  }
  const provided = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ein Tag am Stück sind als JSON gut zwei Megabyte, gepackt ein Fünftel —
  // und die Uhr hängt oft nur über Bluetooth am Netz.
  let raw: Buffer;
  let body: unknown;
  try {
    raw = Buffer.from(await request.arrayBuffer());
    if (request.headers.get("Content-Encoding") === "gzip") raw = gunzipSync(raw);
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const track = parseTrailTrack(body);
  if (!track) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  // Keine Positionen ins Log — nur, was zum Nachvollziehen nötig ist.
  console.log(`[trail] Upload ${track.id}: ${track.points.length} Punkte`);

  // Die Uhr gehört einem Nutzer. Welchem, sagt FLUX_TRAIL_USER_ID — dieselbe
  // Kennung, unter der Fluxtour seine Aktivitäten liest (dort FLUX_USER_ID).
  const userId = process.env.FLUX_TRAIL_USER_ID;
  if (!userId) {
    console.error("FLUX_TRAIL_USER_ID not configured — rejecting upload");
    return NextResponse.json({ error: "Upload not configured" }, { status: 500 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const externalId = trailExternalId(track.id);
  const existing = await db.query.activities.findFirst({
    where: eq(activities.polarId, externalId),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, activityId: existing.id, duplicate: true });
  }

  // In flux gelöscht heisst gelöscht. Die Uhr bekommt Erfolg, damit sie aufhört.
  const blacklisted = await db.query.deletedPolarActivities.findFirst({
    where: and(
      eq(deletedPolarActivities.polarId, externalId),
      eq(deletedPolarActivities.userId, user.id)
    ),
  });
  if (blacklisted) {
    return NextResponse.json({ ok: true, activityId: null, duplicate: true });
  }

  const draft = await buildTrailDraft(track);

  // Den Upload aufbewahren, wie FIT und TCX der anderen Quellen: Ändert sich
  // die Aufbereitung, lässt sich die Wanderung daraus neu einlesen.
  try {
    const dir = join(process.env.FIT_FILES_PATH || "/data/fit-files", user.id);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `flux-trail-${track.id}.json`);
    await writeFile(filePath, raw);
    draft.filePath = filePath;
  } catch (e) {
    console.warn(`[trail] Upload nicht archiviert (${externalId}):`, e);
  }

  const row = await enrichActivity(user, draft);
  let activityId: string | null;
  try {
    activityId = await insertActivity(user, row);
  } catch (e) {
    // Zwei Uploads derselben Wanderung zur gleichen Zeit: Der zweite scheitert
    // an der UNIQUE-Bedingung, und das ist ein Erfolg, kein Fehler.
    const again = await db.query.activities.findFirst({
      where: eq(activities.polarId, externalId),
      columns: { id: true },
    });
    if (again) return NextResponse.json({ ok: true, activityId: again.id, duplicate: true });
    throw e;
  }
  await finishIngest(user.id, user.name);

  console.log(`[trail] Wanderung ${externalId} importiert als ${activityId}`);
  return NextResponse.json({ ok: true, activityId, duplicate: false });
}
