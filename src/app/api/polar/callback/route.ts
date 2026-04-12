import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeToken, registerUser } from "@/lib/polar-client";
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
    return NextResponse.redirect(new URL("/?error=no_code", baseUrl));
  }

  try {
    const callbackUrl = `${baseUrl}/api/polar/callback`;
    const tokenData = await exchangeToken(code, callbackUrl);

    // Register user with Polar (idempotent, non-blocking)
    try {
      await registerUser(tokenData.access_token, String(tokenData.x_user_id));
    } catch (e) {
      console.warn("Polar user registration failed (non-fatal):", e);
    }

    // Save token and Polar user ID
    await db
      .update(users)
      .set({
        polarToken: tokenData.access_token,
        polarUserId: String(tokenData.x_user_id),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.redirect(new URL("/?polar=connected", baseUrl));
  } catch (error) {
    console.error("Polar OAuth error:", error);
    return NextResponse.redirect(
      new URL("/?error=polar_oauth_failed", baseUrl)
    );
  }
}
