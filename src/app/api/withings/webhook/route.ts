import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, weightMeasurements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWeightMeasurements, refreshToken } from "@/lib/withings-client";

// Withings sends GET to verify webhook URL
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

// Withings sends POST with notification data
export async function POST(request: NextRequest) {
  const body = await request.text();
  console.log("Withings webhook received:", body);

  // Parse form-encoded body: userid=xxx&startdate=xxx&enddate=xxx&appli=1
  const params = new URLSearchParams(body);
  const withingsUserId = params.get("userid");
  const appli = params.get("appli");

  // appli=1 = weight, appli=4 = activity
  if (appli !== "1" || !withingsUserId) {
    return NextResponse.json({ received: true });
  }

  // Find user by Withings user ID
  const user = await db.query.users.findFirst({
    where: eq(users.withingsUserId, withingsUserId),
  });

  if (!user?.withingsAccessToken || !user?.withingsRefreshToken) {
    console.warn("No user found for Withings user ID:", withingsUserId);
    return NextResponse.json({ received: true });
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
          withingsTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        })
        .where(eq(users.id, user.id));
    } catch (e) {
      console.error("Withings token refresh failed:", e);
      return NextResponse.json({ received: true });
    }
  }

  // Sync weight data
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // last 7 days
    const measurements = await getWeightMeasurements(accessToken, startDate);
    let synced = 0;

    for (const m of measurements) {
      if (!m.weight) continue;
      const existing = await db.query.weightMeasurements.findFirst({
        where: eq(weightMeasurements.withingsId, String(m.id)),
      });
      if (existing) continue;

      await db.insert(weightMeasurements).values({
        userId: user.id,
        withingsId: String(m.id),
        date: m.date,
        weight: m.weight,
        fatMass: m.fatMass ?? null,
        muscleMass: m.muscleMass ?? null,
        bmi: m.bmi ?? null,
      });
      synced++;
    }
    console.log(`Withings webhook sync: ${synced} new measurements for ${user.name}`);
  } catch (e) {
    console.error("Withings webhook sync error:", e);
  }

  return NextResponse.json({ received: true });
}
