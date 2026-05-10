import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getPhysicalInfo,
  parseIsoDuration,
  type PolarPhysicalInfo,
} from "@/lib/polar-client";

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
      { error: "Polar nicht verbunden" },
      { status: 400 },
    );
  }

  try {
    const synced = await syncPhysicalInfo(user.id, user.polarToken);
    return NextResponse.json({ synced });
  } catch (error) {
    console.error("Physical-info sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Pull /v3/users/physical-info and overwrite the corresponding user columns
 * with Polar's authoritative values (vo2_max, max/resting HR, thresholds,
 * weight, height, gender, training background, sleep goal). Polar's
 * personalized algorithms are more accurate than user-entered defaults.
 */
export async function syncPhysicalInfo(
  userId: string,
  polarToken: string,
): Promise<PolarPhysicalInfo | null> {
  const info = await getPhysicalInfo(polarToken);
  if (!info) {
    console.log("[physical-info] no data");
    return null;
  }

  const updates: Partial<typeof users.$inferInsert> = {
    physicalInfoSyncedAt: new Date(),
  };

  if (typeof info.weight === "number") updates.weightKg = info.weight;
  if (typeof info.height === "number") updates.heightCm = Math.round(info.height);
  if (typeof info.maximum_heart_rate === "number") {
    updates.maxHeartRate = info.maximum_heart_rate;
  }
  if (typeof info.resting_heart_rate === "number") {
    updates.restHeartRate = info.resting_heart_rate;
  }
  if (typeof info.aerobic_threshold === "number") {
    updates.aerobicThreshold = info.aerobic_threshold;
  }
  if (typeof info.anaerobic_threshold === "number") {
    updates.anaerobicThreshold = info.anaerobic_threshold;
  }
  if (typeof info.vo2_max === "number") updates.vo2Max = info.vo2_max;
  if (typeof info.gender === "string") {
    updates.sex = info.gender.toLowerCase();
  }
  if (typeof info.birthday === "string") {
    const d = new Date(info.birthday + "T00:00:00Z");
    if (!isNaN(d.getTime())) updates.birthday = d;
  }
  if (typeof info.training_background === "string") {
    updates.trainingBackground = info.training_background;
  }
  if (typeof info.typical_day === "string") {
    updates.typicalDay = info.typical_day;
  }
  const sleepGoalSec = parseIsoDuration(info.sleep_goal);
  if (sleepGoalSec != null) updates.sleepGoalSec = sleepGoalSec;

  await db.update(users).set(updates).where(eq(users.id, userId));
  console.log("[physical-info] synced fields:", Object.keys(updates));
  return info;
}
