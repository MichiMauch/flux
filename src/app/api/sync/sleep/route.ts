import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, sleepSessions, nightlyRecharge } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  listSleep,
  getSleep,
  listNights,
  getNight,
  type PolarSleep,
  type PolarNight,
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
      { status: 400 }
    );
  }

  try {
    const result = await syncSleep(user.id, user.polarToken);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sleep sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function syncSleep(
  userId: string,
  polarToken: string
): Promise<{ sleepSynced: number; nightsSynced: number }> {
  console.log("[sleep-sync] starting for userId=", userId);

  let sleepSynced = 0;
  let nightsSynced = 0;

  try {
    const sleepList = await listSleep(polarToken);
    console.log("[sleep-sync] sleep nights available:", sleepList.length);
    for (const item of sleepList) {
      try {
        const detail = await getSleep(polarToken, item.date);
        if (!detail) continue;
        await upsertSleep(userId, detail);
        sleepSynced++;
      } catch (e) {
        console.warn(`[sleep-sync] sleep failed for ${item.date}:`, e);
      }
    }
  } catch (e) {
    console.warn("[sleep-sync] listSleep failed:", e);
  }

  try {
    const nightsList = await listNights(polarToken);
    console.log("[sleep-sync] recharge nights available:", nightsList.length);
    for (const item of nightsList) {
      try {
        const detail = await getNight(polarToken, item.date);
        if (!detail) continue;
        await upsertNight(userId, detail);
        nightsSynced++;
      } catch (e) {
        console.warn(`[sleep-sync] night failed for ${item.date}:`, e);
      }
    }
  } catch (e) {
    console.warn("[sleep-sync] listNights failed:", e);
  }

  console.log(
    `[sleep-sync] done. sleepSynced=${sleepSynced} nightsSynced=${nightsSynced}`
  );
  return { sleepSynced, nightsSynced };
}

async function upsertSleep(userId: string, data: PolarSleep): Promise<void> {
  const date = data.date;
  if (!date) return;

  const values = {
    userId,
    date,
    polarUserId: toStr(data.polar_user),
    deviceId: data.device_id ?? null,
    sleepStartTime: toDate(data.sleep_start_time),
    sleepEndTime: toDate(data.sleep_end_time),
    totalSleepSec:
      sumNonNull([data.light_sleep, data.deep_sleep, data.rem_sleep]) ?? null,
    continuity: numOrNull(data.continuity),
    continuityClass: intOrNull(data.continuity_class),
    lightSleepSec: intOrNull(data.light_sleep),
    deepSleepSec: intOrNull(data.deep_sleep),
    remSleepSec: intOrNull(data.rem_sleep),
    unrecognizedSleepSec: intOrNull(data.unrecognized_sleep_stage),
    sleepScore: intOrNull(data.sleep_score),
    sleepCharge: intOrNull(data.sleep_charge),
    sleepRating: intOrNull(data.sleep_rating),
    sleepGoalSec: intOrNull(data.sleep_goal),
    shortInterruptionSec: intOrNull(data.short_interruption_duration),
    longInterruptionSec: intOrNull(data.long_interruption_duration),
    totalInterruptionSec: intOrNull(data.total_interruption_duration),
    sleepCycles: intOrNull(data.sleep_cycles),
    groupDurationScore: intOrNull(data.group_duration_score),
    groupSolidityScore: intOrNull(data.group_solidity_score),
    groupRegenerationScore: intOrNull(data.group_regeneration_score),
    hypnogram: data.hypnogram ?? null,
    heartRateSamples: data.heart_rate_samples ?? null,
    raw: data as unknown,
    updatedAt: new Date(),
  };

  const existing = await db.query.sleepSessions.findFirst({
    where: and(
      eq(sleepSessions.userId, userId),
      eq(sleepSessions.date, date)
    ),
  });

  if (existing) {
    await db
      .update(sleepSessions)
      .set(values)
      .where(eq(sleepSessions.id, existing.id));
  } else {
    await db.insert(sleepSessions).values(values);
  }
}

async function upsertNight(userId: string, data: PolarNight): Promise<void> {
  const date = data.date;
  if (!date) return;

  const values = {
    userId,
    date,
    polarUserId: toStr(data.polar_user),
    heartRateAvg: numOrNull(data.heart_rate_avg),
    beatToBeatAvg: numOrNull(data.beat_to_beat_avg),
    heartRateVariabilityAvg: numOrNull(data.heart_rate_variability_avg),
    breathingRateAvg: numOrNull(data.breathing_rate_avg),
    nightlyRechargeStatus: intOrNull(data.nightly_recharge_status),
    ansCharge: numOrNull(data.ans_charge),
    ansChargeStatus: intOrNull(data.ans_charge_status),
    sleepCharge: intOrNull(data.sleep_charge),
    sleepChargeStatus: intOrNull(data.sleep_charge_status),
    raw: data as unknown,
    updatedAt: new Date(),
  };

  const existing = await db.query.nightlyRecharge.findFirst({
    where: and(
      eq(nightlyRecharge.userId, userId),
      eq(nightlyRecharge.date, date)
    ),
  });

  if (existing) {
    await db
      .update(nightlyRecharge)
      .set(values)
      .where(eq(nightlyRecharge.id, existing.id));
  } else {
    await db.insert(nightlyRecharge).values(values);
  }
}

function intOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function toStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function toDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
function sumNonNull(arr: unknown[]): number | null {
  let sum = 0;
  let any = false;
  for (const v of arr) {
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? Math.round(sum) : null;
}
