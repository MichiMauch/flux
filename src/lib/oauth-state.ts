import { randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

const COOKIE_MAX_AGE_SECONDS = 600;

export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

export function setStateCookie(
  res: NextResponse,
  name: string,
  value: string
): void {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearStateCookie(res: NextResponse, name: string): void {
  res.cookies.set(name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Timing-safe comparison of the request's state param against the stored cookie. */
export function verifyOAuthState(
  request: NextRequest,
  cookieName: string
): boolean {
  const expected = request.cookies.get(cookieName)?.value ?? "";
  const received = request.nextUrl.searchParams.get("state") ?? "";
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
