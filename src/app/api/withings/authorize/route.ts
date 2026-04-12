import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizationUrl } from "@/lib/withings-client";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/withings/callback`;
  const state = crypto.randomUUID();
  const authUrl = getAuthorizationUrl(callbackUrl, state);

  return NextResponse.redirect(authUrl);
}
