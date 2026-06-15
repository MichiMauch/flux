import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "@/lib/polar-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncSleep } from "@/app/api/sync/sleep/route";
import { syncPolarExercises } from "@/lib/polar-sync";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("Polar-Webhook-Signature") ?? "";

  if (!process.env.POLAR_WEBHOOK_SECRET) {
    console.error("POLAR_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }
  const valid = await validateWebhookSignature(body, signature);
  if (!valid) {
    console.warn("Webhook signature invalid");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("Polar webhook received:", payload);

  const event: string | undefined = payload.event;

  // PING is sent by Polar when registering/verifying a webhook — just ack.
  if (event === "PING") {
    return NextResponse.json({ received: true });
  }

  const polarUserId = String(payload.user_id);
  const user = await db.query.users.findFirst({
    where: eq(users.polarUserId, polarUserId),
  });

  if (!user || !user.polarToken) {
    console.warn("No user found for Polar user ID:", polarUserId);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (event === "EXERCISE") {
      await syncPolarExercises(user);
    } else if (event === "ACTIVITY_SUMMARY") {
      const synced = await syncDailyActivity(user.id, user.polarToken);
      console.log(`[webhook] ACTIVITY_SUMMARY: ${synced} days synced for ${user.name}`);
    } else if (event === "SLEEP") {
      const result = await syncSleep(user.id, user.polarToken);
      console.log(
        `[webhook] SLEEP: ${result.sleepSynced} sleep / ${result.nightsSynced} nights synced for ${user.name}`
      );
    } else {
      console.log(`[webhook] unhandled event type: ${event}`);
    }
  } catch (e) {
    console.error(`[webhook] ${event} handler error:`, e);
  }

  return NextResponse.json({ received: true });
}
