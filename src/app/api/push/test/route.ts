import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendPushToUser(session.user.id, {
    title: "Flux",
    body: "Test-Benachrichtigung — alles funktioniert.",
    url: "/",
    tag: "test",
  });

  return NextResponse.json({ ok: true });
}
