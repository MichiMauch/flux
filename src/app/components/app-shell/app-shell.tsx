import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppShellClient } from "./app-shell-client";

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

  const [userRow] = await db
    .select({ image: users.image })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const portraitUrl = userRow?.image ?? null;

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
    >
      {children}
    </AppShellClient>
  );
}
