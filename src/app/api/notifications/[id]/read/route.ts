import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, session.user.id), eq(notifications.id, id))
    );

  return NextResponse.json({ ok: true });
}
