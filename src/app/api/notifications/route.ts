import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";

const LIMIT = 30;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [items, unread] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        url: notifications.url,
        kind: notifications.kind,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(LIMIT),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  return NextResponse.json({
    items,
    unreadCount: unread[0]?.value ?? 0,
  });
}
