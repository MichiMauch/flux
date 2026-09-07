import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeToken, fetchHealthUserId } from "@/lib/google-health-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clearStateCookie, verifyOAuthState } from "@/lib/oauth-state";

const COOKIE = "oauth_state_google";

export async function GET(request: NextRequest) {
  // Immer die konfigurierte Basis-URL, nie request.url — sonst könnte ein
  // manipulierter Host-Header den Code-Tausch auf einen fremden Host lenken.
  // Gleiche Begründung wie im Polar-Callback.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    console.error("NEXT_PUBLIC_BASE_URL not configured — refusing OAuth callback");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  if (!verifyOAuthState(request, COOKIE)) {
    const res = NextResponse.redirect(new URL("/profile?error=oauth_state", baseUrl));
    clearStateCookie(res, COOKIE);
    return res;
  }

  // Der User kann im Consent-Screen abbrechen — dann kommt error=access_denied
  // statt eines Codes zurück.
  const denied = request.nextUrl.searchParams.get("error");
  if (denied) {
    const res = NextResponse.redirect(
      new URL(`/profile?error=google_${denied}`, baseUrl)
    );
    clearStateCookie(res, COOKIE);
    return res;
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const res = NextResponse.redirect(new URL("/profile?error=no_code", baseUrl));
    clearStateCookie(res, COOKIE);
    return res;
  }

  try {
    const callbackUrl = `${baseUrl}/api/google/callback`;
    const tokenData = await exchangeToken(code, callbackUrl);

    if (!tokenData.refresh_token) {
      // Ohne Refresh-Token wäre die Verbindung nach einer Stunde tot. Passiert,
      // wenn access_type=offline oder prompt=consent fehlt — beides setzt
      // getAuthorizationUrl, also ist hier etwas grundsätzlich schief.
      console.error("Google lieferte kein Refresh-Token — Verbindung nicht gespeichert");
      const res = NextResponse.redirect(
        new URL("/profile?error=google_no_refresh_token", baseUrl)
      );
      clearStateCookie(res, COOKIE);
      return res;
    }

    const healthUserId = await fetchHealthUserId(tokenData.access_token);
    if (!healthUserId) {
      console.warn(
        "Google-Nutzernummer nicht ermittelbar — Webhook-Zuordnung fehlt vorerst"
      );
    }

    const [existing] = await db
      .select({ connectedAt: users.googleConnectedAt })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    await db
      .update(users)
      .set({
        googleAccessToken: tokenData.access_token,
        googleRefreshToken: tokenData.refresh_token,
        googleTokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
        ...(healthUserId ? { googleHealthUserId: healthUserId } : {}),
        // Den Stichtag nur beim ERSTEN Verbinden setzen. Wer später neu
        // verbindet, weil der Token abgelaufen ist, würde sich sonst alles
        // wegschneiden, was seit dem Abriss aufgezeichnet wurde.
        ...(existing?.connectedAt ? {} : { googleConnectedAt: new Date() }),
      })
      .where(eq(users.id, session.user.id));

    const res = NextResponse.redirect(new URL("/profile?google=connected", baseUrl));
    clearStateCookie(res, COOKIE);
    return res;
  } catch (error) {
    console.error("Google OAuth error:", error);
    const res = NextResponse.redirect(
      new URL("/profile?error=google_oauth_failed", baseUrl)
    );
    clearStateCookie(res, COOKIE);
    return res;
  }
}
