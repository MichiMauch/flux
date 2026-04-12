import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature } from "@/lib/polar-client";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("Polar-Webhook-Signature") ?? "";

  const valid = await validateWebhookSignature(body, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("Polar webhook received:", payload);

  // TODO: Trigger sync for the affected user
  // payload.event === "EXERCISE" → sync exercises for payload.user_id

  return NextResponse.json({ received: true });
}
