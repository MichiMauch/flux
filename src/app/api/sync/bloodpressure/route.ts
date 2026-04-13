import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { bloodPressureSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface BpSession {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  systolicAvg: number;
  diastolicAvg: number;
  pulseAvg: number;
  note: string | null;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trackerUrl = process.env.BLOOD_PRESSURE_TRACKER_URL;
  const apiKey = process.env.BLOOD_PRESSURE_API_KEY;

  if (!trackerUrl || !apiKey) {
    return NextResponse.json(
      { error: "Blood Pressure Tracker nicht konfiguriert" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${trackerUrl}/api/measurements`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BP API error: ${res.status} ${text}`);
    }

    const sessions: BpSession[] = await res.json();
    let synced = 0;

    for (const s of sessions) {
      const existing = await db.query.bloodPressureSessions.findFirst({
        where: eq(bloodPressureSessions.sourceId, s.id),
      });
      if (existing) continue;

      await db.insert(bloodPressureSessions).values({
        userId: session.user.id,
        sourceId: s.id,
        measuredAt: s.timestamp ? new Date(s.timestamp) : null,
        date: s.date,
        time: s.time,
        systolicAvg: s.systolicAvg,
        diastolicAvg: s.diastolicAvg,
        pulseAvg: s.pulseAvg,
        note: s.note,
      });
      synced++;
    }

    return NextResponse.json({ synced, total: sessions.length });
  } catch (error) {
    console.error("BP sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Sync fehlgeschlagen", details: message },
      { status: 500 }
    );
  }
}
