import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { exchangeToken, subscribeNotification } from "@/lib/withings-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clearStateCookie, verifyOAuthState } from "@/lib/oauth-state";

const COOKIE = "oauth_state_withings";

export async function GET(request: NextRequest) {
  // Always use the configured base URL — never fall back to request.url, which
  // would let an attacker-controlled Host header redirect callers and even
  // route the OAuth code exchange through an attacker-controlled callback URL.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    console.error("NEXT_PUBLIC_BASE_URL not configured — refusing OAuth callback");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  if (!verifyOAuthState(request, COOKIE)) {
    const res = NextResponse.redirect(
      new URL("/health?error=oauth_state", baseUrl)
    );
    clearStateCookie(res, COOKIE);
    return res;
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const res = NextResponse.redirect(new URL("/health?error=no_code", baseUrl));
    clearStateCookie(res, COOKIE);
    return res;
  }

  try {
    const callbackUrl = `${baseUrl}/api/withings/callback`;
    const tokenData = await exchangeToken(code, callbackUrl);

    // Per-user webhook token. Reuse an existing one if the user has connected
    // before — that lets Withings keep posting to the same URL without us
    // needing to re-subscribe / clean up stale subscriptions.
    const existing = await db
      .select({ token: users.withingsWebhookToken })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const webhookToken = existing[0]?.token ?? randomUUID();

    await db
      .update(users)
      .set({
        withingsAccessToken: tokenData.access_token,
        withingsRefreshToken: tokenData.refresh_token,
        withingsUserId: String(tokenData.userid),
        withingsTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
        withingsWebhookToken: webhookToken,
      })
      .where(eq(users.id, session.user.id));

    if (baseUrl.startsWith("https://")) {
      const webhookUrl = `${baseUrl}/api/withings/webhook/${webhookToken}`;
      try {
        await subscribeNotification(tokenData.access_token, webhookUrl, 1, "flux-weight");
      } catch (e) {
        // Don't log the URL itself — it contains the per-user token.
        console.error("Withings webhook subscribe failed:", (e as Error).message);
      }
    }

    const res = NextResponse.redirect(
      new URL("/health?withings=connected", baseUrl)
    );
    clearStateCookie(res, COOKIE);
    return res;
  } catch (error) {
    console.error("Withings OAuth error:", error);
    const res = NextResponse.redirect(
      new URL("/health?error=withings_oauth_failed", baseUrl)
    );
    clearStateCookie(res, COOKIE);
    return res;
  }
}
