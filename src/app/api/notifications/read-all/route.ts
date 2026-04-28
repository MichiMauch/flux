import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );

  return NextResponse.json({ ok: true });
}
