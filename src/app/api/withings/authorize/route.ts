import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizationUrl } from "@/lib/withings-client";
import { generateOAuthState, setStateCookie } from "@/lib/oauth-state";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/withings/callback`;
  const state = generateOAuthState();
  const authUrl = getAuthorizationUrl(callbackUrl, state);

  const res = NextResponse.redirect(authUrl);
  setStateCookie(res, "oauth_state_withings", state);
  return res;
}
