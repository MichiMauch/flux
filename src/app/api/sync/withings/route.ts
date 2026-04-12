import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, weightMeasurements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getWeightMeasurements,
  refreshToken,
} from "@/lib/withings-client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.withingsAccessToken || !user?.withingsRefreshToken) {
    return NextResponse.json(
      { error: "Withings nicht verbunden" },
      { status: 400 }
    );
  }

  let accessToken = user.withingsAccessToken;

  // Refresh token if expired
  if (user.withingsTokenExpiry && user.withingsTokenExpiry < new Date()) {
    try {
      const refreshed = await refreshToken(user.withingsRefreshToken);
      accessToken = refreshed.access_token;

      await db
        .update(users)
        .set({
          withingsAccessToken: refreshed.access_token,
          withingsRefreshToken: refreshed.refresh_token,
          withingsTokenExpiry: new Date(
            Date.now() + refreshed.expires_in * 1000
          ),
        })
        .where(eq(users.id, session.user.id));
    } catch (e) {
      console.error("Withings token refresh failed:", e);
      return NextResponse.json(
        { error: "Token refresh fehlgeschlagen" },
        { status: 500 }
      );
    }
  }

  try {
    // Fetch last 90 days of weight data
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const measurements = await getWeightMeasurements(accessToken, startDate);
    let synced = 0;

    for (const m of measurements) {
      if (!m.weight) continue;

      const existing = await db.query.weightMeasurements.findFirst({
        where: eq(weightMeasurements.withingsId, String(m.id)),
      });
      if (existing) continue;

      await db.insert(weightMeasurements).values({
        userId: session.user.id,
        withingsId: String(m.id),
        date: m.date,
        weight: m.weight,
        fatMass: m.fatMass ?? null,
        muscleMass: m.muscleMass ?? null,
        bmi: m.bmi ?? null,
      });
      synced++;
    }

    return NextResponse.json({ synced, total: measurements.length });
  } catch (error) {
    console.error("Withings sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Sync fehlgeschlagen", details: message },
      { status: 500 }
    );
  }
}
