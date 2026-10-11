import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, weightMeasurements } from "@/lib/db/schema";
import { bpDefaultUserEmail } from "@/lib/blood-pressure";

const MAX_DAYS = 365;

// Read-only export of weight measurements for the Health app, which shows
// them next to the data entered there. Same shared key and the same user
// mapping as the blood pressure webhook: ?email= names the account, without it
// the default account is used.
export async function GET(request: NextRequest) {
  const expected = process.env.BLOOD_PRESSURE_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  const provided =
    request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const email = params.get("email") ?? bpDefaultUserEmail();
  const days = Math.min(
    Math.max(Number(params.get("days")) || 90, 1),
    MAX_DAYS
  );

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      date: weightMeasurements.date,
      weight: weightMeasurements.weight,
      fatMass: weightMeasurements.fatMass,
      muscleMass: weightMeasurements.muscleMass,
      bmi: weightMeasurements.bmi,
    })
    .from(weightMeasurements)
    .where(
      and(
        eq(weightMeasurements.userId, user.id),
        gte(weightMeasurements.date, since)
      )
    )
    .orderBy(desc(weightMeasurements.date));

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "no-store" },
  });
}
