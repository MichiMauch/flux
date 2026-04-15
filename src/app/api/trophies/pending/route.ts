import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listPendingUnlocks,
  ackPendingUnlocks,
} from "@/lib/trophies-server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listPendingUnlocks(session.user.id);
  return NextResponse.json({ pending: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? body.ids.filter((i: unknown) => typeof i === "string") : [];
  await ackPendingUnlocks(session.user.id, ids);
  return NextResponse.json({ ok: true });
}
