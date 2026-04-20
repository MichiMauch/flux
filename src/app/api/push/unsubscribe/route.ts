import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteSubscription } from "@/lib/push";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await deleteSubscription(session.user.id, endpoint);
  return NextResponse.json({ ok: true });
}
