import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { AppShellClient } from "./app-shell-client";
import type { NotificationItem } from "./notification-bell";

const NOTIFICATIONS_LIMIT = 30;

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    return <>{children}</>;
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "?";

  const userId = session.user.id;

  const [userRow, notifRows, unreadRow] = await Promise.all([
    db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
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
      .limit(NOTIFICATIONS_LIMIT),
    db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);

  const portraitUrl = userRow[0]?.image ?? null;

  const initialNotifications: NotificationItem[] = notifRows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    url: n.url,
    kind: n.kind,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));
  const initialUnread = unreadRow[0]?.value ?? 0;

  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AppShellClient
      userName={session.user.name ?? ""}
      userEmail={session.user.email ?? ""}
      portraitUrl={portraitUrl}
      initials={initials}
      logoutAction={logoutAction}
      initialNotifications={initialNotifications}
      initialUnreadNotifications={initialUnread}
    >
      {children}
    </AppShellClient>
  );
}
