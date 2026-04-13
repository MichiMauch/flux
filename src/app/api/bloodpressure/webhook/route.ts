import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, bloodPressureSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Webhook receives new BP measurement from blood-pressure-tracker
export async function POST(request: NextRequest) {
  // Validate API key
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!apiKey || apiKey !== process.env.BLOOD_PRESSURE_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  console.log("BP webhook received:", body);

  // Hardcode to Michi (BP is only for him)
  const user = await db.query.users.findFirst({
    where: eq(users.email, "michi.mauch@gmail.com"),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Idempotent insert via source_id
  const existing = await db.query.bloodPressureSessions.findFirst({
    where: eq(bloodPressureSessions.sourceId, body.id),
  });
  if (existing) {
    return NextResponse.json({ skipped: true });
  }

  await db.insert(bloodPressureSessions).values({
    userId: user.id,
    sourceId: body.id,
    measuredAt: body.timestamp ? new Date(body.timestamp) : null,
    date: body.date,
    time: body.time,
    systolicAvg: body.systolicAvg,
    diastolicAvg: body.diastolicAvg,
    pulseAvg: body.pulseAvg,
    note: body.note ?? null,
  });

  console.log(`BP webhook synced measurement #${body.id}`);
  return NextResponse.json({ synced: true });
}
