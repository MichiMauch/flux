import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { bloodPressureSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { bpDefaultUserEmail, pickBpReading } from "@/lib/blood-pressure";

// Plus the measurement fields (systolic1/2, …Avg) that pickBpReading reads.
interface BpSession extends Record<string, unknown> {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  note: string | null;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
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
    // The tracker is multi-user: fluxEmail selects whose measurements we get.
    const url = new URL(`${trackerUrl}/api/measurements`);
    url.searchParams.set("fluxEmail", session.user.email);
    const init = {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    } as const;
    let res = await fetch(url, init);

    // The tracker's first user may have no fluxEmail mapping; without the
    // parameter the tracker returns that user's measurements. Only the
    // default account may fall back to them.
    if (
      res.status === 404 &&
      session.user.email.toLowerCase() === bpDefaultUserEmail().toLowerCase()
    ) {
      url.searchParams.delete("fluxEmail");
      res = await fetch(url, init);
    }

    // No tracker account mapped to this Flux user
    if (res.status === 404) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`BP API error: ${res.status} ${text}`);
    }

    const sessions: BpSession[] = await res.json();
    let synced = 0;
    let updated = 0;

    for (const s of sessions) {
      const reading = pickBpReading(s);
      if (!reading) continue;

      const existing = await db.query.bloodPressureSessions.findFirst({
        where: eq(bloodPressureSessions.sourceId, s.id),
      });
      if (existing) {
        // Rows synced before Flux kept the better measurement still hold the
        // session average — bring them in line with the tracker.
        if (
          existing.userId === session.user.id &&
          (existing.systolic !== reading.systolic ||
            existing.diastolic !== reading.diastolic ||
            existing.pulse !== reading.pulse)
        ) {
          await db
            .update(bloodPressureSessions)
            .set(reading)
            .where(eq(bloodPressureSessions.id, existing.id));
          updated++;
        }
        continue;
      }

      await db.insert(bloodPressureSessions).values({
        userId: session.user.id,
        sourceId: s.id,
        measuredAt: s.timestamp ? new Date(s.timestamp) : null,
        date: s.date,
        time: s.time,
        ...reading,
        note: s.note,
      });
      synced++;
    }

    return NextResponse.json({ synced, updated, total: sessions.length });
  } catch (error) {
    console.error("BP sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Sync fehlgeschlagen", details: message },
      { status: 500 }
    );
  }
}
