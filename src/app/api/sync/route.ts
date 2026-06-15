import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PolarAuthError } from "@/lib/polar-client";
import { syncPolarExercises } from "@/lib/polar-sync";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncPhysicalInfo } from "@/app/api/sync/physical-info/route";
import { syncSleep } from "@/app/api/sync/sleep/route";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.polarToken) {
    return NextResponse.json(
      { error: "Polar nicht verbunden", needsReauth: true },
      { status: 400 }
    );
  }

  try {
    const { synced, unlockedTrophies } = await syncPolarExercises(user);

    // Daily activity (best effort)
    let dailySynced = 0;
    try {
      dailySynced = await syncDailyActivity(user.id, user.polarToken);
    } catch (e) {
      console.error("Daily activity sync failed:", e);
    }

    // Sleep + Nightly Recharge (best effort)
    let sleepSynced = 0;
    let nightsSynced = 0;
    try {
      const r = await syncSleep(user.id, user.polarToken);
      sleepSynced = r.sleepSynced;
      nightsSynced = r.nightsSynced;
    } catch (e) {
      console.error("Sleep sync failed:", e);
    }

    // Physical info — overwrite user fields with Polar's authoritative values
    // (best effort).
    try {
      await syncPhysicalInfo(user.id, user.polarToken);
    } catch (e) {
      console.error("Physical-info sync failed:", e);
    }

    return NextResponse.json({
      synced,
      dailySynced,
      sleepSynced,
      nightsSynced,
      unlockedTrophies,
    });
  } catch (error) {
    // A dead/revoked Polar token is unrecoverable without a fresh OAuth flow —
    // tell the client to prompt a reconnect instead of showing a vague error.
    if (error instanceof PolarAuthError) {
      console.warn("Sync aborted — Polar token rejected:", error.message);
      return NextResponse.json(
        {
          error: "Polar-Verbindung abgelaufen — bitte neu verbinden",
          needsReauth: true,
        },
        { status: 401 }
      );
    }
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Sync fehlgeschlagen", details: message },
      { status: 500 }
    );
  }
}
