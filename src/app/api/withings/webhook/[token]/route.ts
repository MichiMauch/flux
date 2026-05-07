import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, weightMeasurements } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getWeightMeasurements, refreshToken } from "@/lib/withings-client";

// Per-user webhook URL. Withings doesn't support auth headers, so the auth
// token has to live in the URL. We use a per-user random UUID stored in
// users.withingsWebhookToken instead of a single shared global secret — this
// way, if the URL leaks via 3rd-party logs, only that one user's data can be
// re-synced (the worst case is still bounded since syncs are idempotent).

// Withings sends GET to verify webhook URL
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await findUserByToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ status: "ok" });
}

// Withings sends POST with notification data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await findUserByToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.text();

  // Parse form-encoded body: userid=xxx&startdate=xxx&enddate=xxx&appli=1
  const params2 = new URLSearchParams(body);
  const withingsUserId = params2.get("userid");
  const appli = params2.get("appli");

  console.log(
    `Withings webhook received: appli=${appli} userid=${withingsUserId ? "[set]" : "[missing]"}`
  );

  // appli=1 = weight, appli=4 = activity
  if (appli !== "1") {
    return NextResponse.json({ received: true });
  }

  // Defence-in-depth: ensure the body's withings user id matches the URL token
  // owner — otherwise an attacker who knows one user's token couldn't trick us
  // into syncing a different user's data, but we'd still spend an outbound
  // call. Skip if mismatch.
  if (
    withingsUserId &&
    user.withingsUserId &&
    withingsUserId !== user.withingsUserId
  ) {
    console.warn("Withings webhook: userid in body does not match token owner");
    return NextResponse.json({ received: true });
  }

  if (!user.withingsAccessToken || !user.withingsRefreshToken) {
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
    console.log(`Withings webhook sync: ${synced} new measurements for user ${user.id}`);
  } catch (e) {
    console.error("Withings webhook sync error:", e);
  }

  return NextResponse.json({ received: true });
}

async function findUserByToken(token: string) {
  // UUIDs are unguessable, so a simple equality lookup is fine. We require a
  // non-empty token to avoid accidental matches against legacy NULL values.
  if (!token || token.length < 16) return null;
  return db.query.users.findFirst({
    where: eq(users.withingsWebhookToken, token),
  });
}
