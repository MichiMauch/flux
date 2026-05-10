import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, dailyActivity, dailyPolarExtras } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  listActivitiesV3,
  parseIsoDuration,
  listCardioLoad,
  getContinuousHeartRate,
  getSleepWiseAlertness,
  getSleepWiseCircadianBedtime,
  getBodyTemperature,
  getSkinTemperature,
  getSkinContacts,
  getSpo2,
  getWristEcg,
  type PolarActivityV3,
} from "@/lib/polar-client";
import { sendPushToUser } from "@/lib/push";

const STEP_GOAL = 10_000;
// How many days back to refetch on each sync. Polar's max range is 28; we
// pick a sensible default that covers webhook-late-arrivals + occasional
// retroactive corrections from the watch.
const DEFAULT_SYNC_DAYS = 7;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Derive a YYYY-MM-DD date from a v3 activity entry. */
function v3Date(a: PolarActivityV3): string | null {
  if (typeof a.samples?.date === "string") return a.samples.date;
  if (typeof a.start_time === "string") return a.start_time.slice(0, 10);
  return null;
}

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
    const synced = await syncDailyActivity(user.id, user.polarToken);
    return NextResponse.json({ synced });
  } catch (error) {
    console.error("Daily sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Pull daily activity for the last DEFAULT_SYNC_DAYS via Polar's
 * non-deprecated `/v3/users/activities` list endpoint. Idempotent — same call
 * reapplied is a no-op. Replaces the deprecated activity-transactions flow.
 */
export async function syncDailyActivity(
  userId: string,
  polarToken: string,
): Promise<number> {
  const from = daysAgoIso(DEFAULT_SYNC_DAYS);
  const to = todayIso();
  console.log(`[daily-sync] from=${from} to=${to}`);

  const days = await listActivitiesV3(polarToken, {
    from,
    to,
    inactivityStamps: true,
    activityZones: true,
    steps: true,
  });
  console.log(`[daily-sync] received ${days.length} days`);

  let synced = 0;
  for (const day of days) {
    const date = v3Date(day);
    if (!date) continue;
    try {
      await upsertDailyActivity(userId, day, date);
      try {
        await upsertDailyPolarExtras(userId, polarToken, date);
      } catch (e) {
        console.warn(`[daily-sync] extras failed for ${date}:`, e);
      }
      synced++;
    } catch (e) {
      console.warn(`[daily-sync] upsert failed for ${date}:`, e);
    }
  }
  console.log(`[daily-sync] synced=${synced}`);
  return synced;
}

/**
 * Upsert a daily-activity row from a v3 endpoint response.
 * `date` is derived from start_time / samples.date by the caller.
 */
export async function upsertDailyActivity(
  userId: string,
  v3: PolarActivityV3,
  date: string,
): Promise<void> {
  const durationSec = parseIsoDuration(v3.active_duration);
  const inactiveDurationSec = parseIsoDuration(v3.inactive_duration);

  const stepsTotal = typeof v3.steps === "number" ? v3.steps : null;
  const calories = typeof v3.calories === "number" ? v3.calories : null;
  const activeCalories =
    typeof v3.active_calories === "number" ? v3.active_calories : null;
  const distance =
    typeof v3.distance_from_steps === "number"
      ? v3.distance_from_steps
      : null;
  const completion =
    typeof v3.daily_activity === "number" ? v3.daily_activity : null;

  // Polar v3 wraps stamps as { samples: [...] } despite docs claiming a flat
  // array. Normalize to the inner array so all readers see one shape.
  const v3Stamps = v3.samples?.inactivity_stamps;
  const v3StampsArray = Array.isArray(v3Stamps)
    ? v3Stamps
    : v3Stamps?.samples ?? null;
  const inactivityAlertCount =
    typeof v3.inactivity_alert_count === "number"
      ? v3.inactivity_alert_count
      : null;

  const existing = await db.query.dailyActivity.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.date, date)),
  });

  const values = {
    userId,
    date,
    polarActivityId: null,
    steps: stepsTotal,
    // v3 only returns total `steps` — keep activeSteps in sync (semantically
    // ≈ same number; readers fall back to either).
    activeSteps: stepsTotal,
    calories,
    activeCalories,
    durationSec,
    distance,
    activeTimeGoalSec: null,
    activeGoalCompletion: completion,
    activeTimeZones: null,
    inactivityStamps: v3StampsArray ?? null,
    inactivityAlertCount,
    inactiveDurationSec,
    raw: null,
    rawV3: v3,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(dailyActivity)
      .set(values)
      .where(eq(dailyActivity.id, existing.id));
  } else {
    await db.insert(dailyActivity).values(values);
  }

  const newlyReached =
    date === todayIso() &&
    stepsTotal != null &&
    stepsTotal >= STEP_GOAL &&
    (existing?.steps ?? 0) < STEP_GOAL;

  if (newlyReached) {
    try {
      await sendPushToUser(userId, {
        title: "Schrittziel erreicht",
        body: `${stepsTotal!.toLocaleString("de-CH")} Schritte heute — weiter so!`,
        url: "/daily",
        tag: `steps-${date}`,
        kind: "steps_goal",
      });
    } catch (e) {
      console.error("[push] step goal notification failed:", e);
    }
  }
}

/**
 * Pull data from Polar's "extras" endpoints (cardio-load, continuous-HR,
 * sleep-wise, body/skin temperature, spo2, wrist-ecg) for a given date and
 * upsert into the daily_polar_extras table. Each individual fetch is
 * best-effort — any single failure is logged but doesn't abort the others.
 */
export async function upsertDailyPolarExtras(
  userId: string,
  polarToken: string,
  date: string,
): Promise<void> {
  // Run all fetches in parallel; any single failure resolves to null.
  const safe = <T>(p: Promise<T | null>): Promise<T | null> =>
    p.catch((e) => {
      console.warn(`[daily-extras] fetch failed for ${date}:`, e);
      return null;
    });

  const [
    cardioLoadList,
    continuousHr,
    alertness,
    circadianBedtime,
    bodyTemp,
    skinTemp,
    skinContacts,
    ecg,
    spo2,
  ] = await Promise.all([
    safe(listCardioLoad(polarToken).then((r) => r as unknown)),
    safe(getContinuousHeartRate(polarToken, date)),
    safe(getSleepWiseAlertness(polarToken).then((r) => r as unknown)),
    safe(
      getSleepWiseCircadianBedtime(polarToken).then((r) => r as unknown),
    ),
    safe(
      getBodyTemperature(polarToken, date, date).then((r) => r as unknown),
    ),
    safe(
      getSkinTemperature(polarToken, date, date).then((r) => r as unknown),
    ),
    safe(getSkinContacts(polarToken, date, date).then((r) => r as unknown)),
    safe(getWristEcg(polarToken, date, date).then((r) => r as unknown)),
    safe(getSpo2(polarToken, date, date).then((r) => r as unknown)),
  ]);

  // Find this date's cardio-load entry from the list (it returns ~28 days).
  const cardioLoadDay = Array.isArray(cardioLoadList)
    ? (cardioLoadList as Array<{ date?: string }>).find((d) => d.date === date)
    : null;
  const cl = cardioLoadDay as
    | {
        cardio_load?: number;
        cardio_load_status?: string;
        strain?: number;
        tolerance?: number;
        cardio_load_ratio?: number;
        cardio_load_level?: unknown;
      }
    | null;

  const hr = continuousHr as { heart_rate_samples?: unknown } | null;

  const existing = await db.query.dailyPolarExtras.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.date, date)),
  });

  const values = {
    userId,
    date,
    cardioLoad: typeof cl?.cardio_load === "number" ? cl.cardio_load : null,
    cardioLoadStatus: cl?.cardio_load_status ?? null,
    cardioLoadStrain: typeof cl?.strain === "number" ? cl.strain : null,
    cardioLoadTolerance:
      typeof cl?.tolerance === "number" ? cl.tolerance : null,
    cardioLoadRatio:
      typeof cl?.cardio_load_ratio === "number" ? cl.cardio_load_ratio : null,
    cardioLoadLevel: cl?.cardio_load_level ?? null,
    cardioLoadRaw: cardioLoadDay ?? null,
    continuousHrSamples: hr?.heart_rate_samples ?? null,
    continuousHrRaw: continuousHr ?? null,
    alertnessRaw: alertness ?? null,
    circadianBedtimeRaw: circadianBedtime ?? null,
    bodyTemperatureRaw: bodyTemp ?? null,
    skinTemperatureRaw: skinTemp ?? null,
    skinContactsRaw: skinContacts ?? null,
    wristEcgRaw: ecg ?? null,
    spo2Raw: spo2 ?? null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(dailyPolarExtras)
      .set(values)
      .where(eq(dailyPolarExtras.id, existing.id));
  } else {
    await db.insert(dailyPolarExtras).values(values);
  }
}
