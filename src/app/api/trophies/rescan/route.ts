import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { evaluateTrophies } from "@/lib/trophies-server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const unlocked = await evaluateTrophies(session.user.id);
  return NextResponse.json({ unlocked });
}
