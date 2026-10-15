import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ACTIVITY_TYPE_OPTIONS } from "@/lib/activity-types";
import { enrichActivity } from "@/lib/activities/ingest";
import { insertActivity, finishIngest } from "@/lib/activities/ingest-effects";

/**
 * Von Hand erfasste Aktivität anlegen — für alles, was kein Gerät
 * aufgezeichnet hat: das vergessene Krafttraining, die Yogastunde ohne Uhr.
 *
 * Läuft durch dieselbe Aufbereitung wie die Syncs (TRIMP, Titel) und löst
 * dieselben Seiteneffekte aus (Push, Trophäen, Home-Cache). Ohne Route gibt
 * es keinen Ort aufzulösen; die Detailseite kommt damit zurecht wie bei
 * Google-Aktivitäten ohne GPS.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const errors: string[] = [];

  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!ACTIVITY_TYPE_OPTIONS.some((o) => o.value === type)) {
    errors.push("Unbekannte Sportart.");
  }

  const startTime = typeof body.startTime === "string" ? new Date(body.startTime) : null;
  if (!startTime || Number.isNaN(startTime.getTime())) {
    errors.push("Startzeit fehlt.");
  } else if (startTime.getTime() > Date.now() + 5 * 60_000) {
    errors.push("Startzeit liegt in der Zukunft.");
  }

  // Zahlenfelder: leer heisst «nicht erfasst», alles andere muss in den
  // Bereich passen. Die Grenzen fangen Tippfehler ab, nicht Rekorde.
  function num(field: string, label: string, min: number, max: number): number | null {
    const v = body[field];
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors.push(`${label} muss zwischen ${min} und ${max} liegen.`);
      return null;
    }
    return n;
  }

  const duration = num("duration", "Dauer (s)", 60, 48 * 3600);
  if (duration == null && !errors.some((e) => e.startsWith("Dauer"))) {
    errors.push("Dauer fehlt.");
  }
  const distance = num("distance", "Distanz (m)", 0, 1_000_000);
  const ascent = num("ascent", "Aufstieg (m)", 0, 20_000);
  const avgHeartRate = num("avgHeartRate", "Ø Puls", 30, 250);
  const calories = num("calories", "Kalorien", 0, 20_000);

  const title = typeof body.name === "string" ? body.name.trim() : "";
  if (title.length > 200) errors.push("Titel zu lang (max 200).");
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (notes.length > 2000) errors.push("Notiz zu lang (max 2000).");

  if (errors.length > 0 || !startTime || duration == null) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const durationSec = Math.round(duration);
  const row = await enrichActivity(user, {
    source: "manual",
    externalId: null,
    type,
    subType: null,
    fallbackTitle: ACTIVITY_TYPE_OPTIONS.find((o) => o.value === type)?.label,
    title: title || null,
    startTime,
    duration: durationSec,
    movingTime: durationSec,
    distance,
    calories: calories != null ? Math.round(calories) : null,
    avgHeartRate: avgHeartRate != null ? Math.round(avgHeartRate) : null,
    maxHeartRate: null,
    ascent,
    descent: null,
    minAltitude: null,
    maxAltitude: null,
    avgCadence: null,
    maxCadence: null,
    totalSteps: null,
    // km/h, wie in der Spalte vereinbart.
    avgSpeed: distance ? distance / 1000 / (durationSec / 3600) : null,
    maxSpeed: null,
    routeData: null,
    heartRateData: null,
    speedData: null,
    device: null,
    filePath: null,
  });
  row.notes = notes || null;

  const activityId = await insertActivity(user, row);
  if (!activityId) {
    return NextResponse.json({ error: "Speichern fehlgeschlagen." }, { status: 500 });
  }
  await finishIngest(user.id, user.name);

  return NextResponse.json({ activityId }, { status: 201 });
}
