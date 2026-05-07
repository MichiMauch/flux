import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { users, bloodPressureSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Webhook receives new BP measurement from blood-pressure-tracker
export async function POST(request: NextRequest) {
  const expected = process.env.BLOOD_PRESSURE_API_KEY;
  if (!expected) {
    console.error("BLOOD_PRESSURE_API_KEY not configured — rejecting webhook");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }
  const provided =
    request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as unknown;
  // Don't log the raw body — systolic/diastolic/pulse values are health PII
  // and would land in stdout/Coolify log aggregation. Log only the source id
  // for traceability.
  const rawId = isRecord(body) ? body.id : undefined;
  console.log(`BP webhook received: id=${rawId ?? "[missing]"}`);

  // Validate the payload before touching the DB. The blood-pressure-tracker
  // service is trusted (auth via shared bearer above), but a corrupt payload
  // would still cause DB constraint errors and pollute logs.
  const parsed = parseBpPayload(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Target user: configurable via BLOOD_PRESSURE_USER_EMAIL, with the legacy
  // hardcoded address as fallback so existing deployments keep working until
  // the env var is set. (BP-tracker is single-tenant for now.)
  const targetEmail =
    process.env.BLOOD_PRESSURE_USER_EMAIL ?? "michi.mauch@gmail.com";
  const user = await db.query.users.findFirst({
    where: eq(users.email, targetEmail),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Idempotent insert via source_id
  const existing = await db.query.bloodPressureSessions.findFirst({
    where: eq(bloodPressureSessions.sourceId, parsed.id),
  });
  if (existing) {
    return NextResponse.json({ skipped: true });
  }

  await db.insert(bloodPressureSessions).values({
    userId: user.id,
    sourceId: parsed.id,
    measuredAt: parsed.measuredAt,
    date: parsed.date,
    time: parsed.time,
    systolicAvg: parsed.systolicAvg,
    diastolicAvg: parsed.diastolicAvg,
    pulseAvg: parsed.pulseAvg,
    note: parsed.note,
  });

  console.log(`BP webhook synced measurement #${parsed.id}`);
  return NextResponse.json({ synced: true });
}

// Plausible physiological ranges (mmHg / bpm). Outside-of-range values are
// almost certainly junk and shouldn't enter the dataset.
const SYS_MIN = 50;
const SYS_MAX = 260;
const DIA_MIN = 30;
const DIA_MAX = 200;
const PULSE_MIN = 20;
const PULSE_MAX = 250;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function inRange(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

interface BpPayload {
  id: number;
  measuredAt: Date | null;
  date: string;
  time: string | null;
  systolicAvg: number;
  diastolicAvg: number;
  pulseAvg: number | null;
  note: string | null;
}

function parseBpPayload(body: unknown): BpPayload | null {
  if (!isRecord(body)) return null;
  if (typeof body.id !== "number" || !Number.isFinite(body.id)) return null;
  if (typeof body.date !== "string" || body.date.length === 0) return null;
  if (!inRange(body.systolicAvg, SYS_MIN, SYS_MAX)) return null;
  if (!inRange(body.diastolicAvg, DIA_MIN, DIA_MAX)) return null;
  const pulse =
    body.pulseAvg == null
      ? null
      : inRange(body.pulseAvg, PULSE_MIN, PULSE_MAX)
        ? body.pulseAvg
        : null;
  let measuredAt: Date | null = null;
  if (typeof body.timestamp === "string" || typeof body.timestamp === "number") {
    const d = new Date(body.timestamp);
    if (!Number.isNaN(d.getTime())) measuredAt = d;
  }
  const time = typeof body.time === "string" ? body.time : null;
  const note = typeof body.note === "string" ? body.note : null;
  return {
    id: body.id,
    measuredAt,
    date: body.date,
    time,
    systolicAvg: body.systolicAvg,
    diastolicAvg: body.diastolicAvg,
    pulseAvg: pulse,
    note,
  };
}
