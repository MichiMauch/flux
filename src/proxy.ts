import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

const publicRoutes = [
  "/login",
  "/api/auth",
  "/api/polar/webhook",
  "/api/withings/webhook",
  "/api/bloodpressure/webhook",
  "/api/cron",
  "/share",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Share-token-bypass: media endpoints that accept ?share=<token>.
  // The route handler itself validates the token against the DB.
  if (request.nextUrl.searchParams.has("share")) {
    if (
      pathname.startsWith("/api/photos/") ||
      pathname.match(/^\/api\/activities\/[^/]+\/gpx$/) ||
      pathname.match(/^\/api\/activities\/[^/]+\/share-card$/) ||
      pathname.match(/^\/api\/tours\/[^/]+\/cover$/)
    ) {
      return NextResponse.next();
    }
  }

  // Check session
  const session = await auth();

  if (!session) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url;
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)" ],
};
