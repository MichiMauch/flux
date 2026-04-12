import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeToken } from "@/lib/withings-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/health?error=no_code", baseUrl));
  }

  try {
    const callbackUrl = `${baseUrl}/api/withings/callback`;
    const tokenData = await exchangeToken(code, callbackUrl);

    await db
      .update(users)
      .set({
        withingsAccessToken: tokenData.access_token,
        withingsRefreshToken: tokenData.refresh_token,
        withingsUserId: String(tokenData.userid),
        withingsTokenExpiry: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.redirect(new URL("/health?withings=connected", baseUrl));
  } catch (error) {
    console.error("Withings OAuth error:", error);
    return NextResponse.redirect(
      new URL("/health?error=withings_oauth_failed", baseUrl)
    );
  }
}
