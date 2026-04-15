import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadTrophyState, computeLevel } from "@/lib/trophies-server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [trophies, level] = await Promise.all([
    loadTrophyState(session.user.id),
    computeLevel(session.user.id),
  ]);
  return NextResponse.json({ trophies, level });
}
