import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, dailyActivity } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  createActivityTransaction,
  listDailyActivities,
  getDailyActivity,
  commitActivityTransaction,
  parseIsoDuration,
  type PolarDailyActivity,
} from "@/lib/polar-client";
import { sendPushToUser } from "@/lib/push";

const STEP_GOAL = 10_000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.polarToken || !user?.polarUserId) {
    return NextResponse.json(
      { error: "Polar nicht verbunden" },
      { status: 400 }
    );
  }

  try {
    const synced = await syncDailyActivity(
      user.id,
      user.polarToken,
      user.polarUserId
    );
    return NextResponse.json({ synced });
  } catch (error) {
    console.error("Daily sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function syncDailyActivity(
  userId: string,
  polarToken: string,
  polarUserId: string
): Promise<number> {
  console.log("[daily-sync] starting for polarUserId=", polarUserId);
  const transaction = await createActivityTransaction(polarToken, polarUserId);
  if (!transaction) {
    console.log("[daily-sync] no new transaction (204) — nothing to pull");
    return 0;
  }
  const tid = transaction["transaction-id"];
  console.log("[daily-sync] transaction-id:", tid);

  const list = await listDailyActivities(polarToken, polarUserId, tid);
  console.log("[daily-sync] days in transaction:", list.length);
  let synced = 0;

  for (const url of list) {
    try {
      const detail = await getDailyActivity(polarToken, url);
      console.log(
        "[daily-sync] fetched day:",
        detail.date,
        "steps=",
        (detail as { steps?: unknown }).steps
      );
      await upsertDailyActivity(userId, detail);
      synced++;
    } catch (e) {
      console.warn(`[daily-sync] failed for ${url}:`, e);
    }
  }

  await commitActivityTransaction(polarToken, polarUserId, tid);
  console.log("[daily-sync] committed, synced=", synced);
  return synced;
}

export async function upsertDailyActivity(
  userId: string,
  data: PolarDailyActivity
): Promise<void> {
  const date = data.date;
  if (!date) return;

  const durationSec = parseIsoDuration(data.duration);
  const activeTimeGoalSec = parseIsoDuration(data["active-time-goal"]);
  const stepsTotal =
    typeof data["steps"] === "number" ? (data["steps"] as number) : null;
  const activeSteps = data["active-steps"] ?? null;
  const calories = data.calories ?? null;
  const activeCalories = data["active-calories"] ?? null;
  const distance = data.distance ?? null;
  const completion = data["active-goal-completion"] ?? null;

  const existing = await db.query.dailyActivity.findFirst({
    where: (t, { and, eq }) => and(eq(t.userId, userId), eq(t.date, date)),
  });

  const values = {
    userId,
    date,
    polarActivityId: data.id ?? null,
    steps: stepsTotal,
    activeSteps: activeSteps as number | null,
    calories,
    activeCalories: activeCalories as number | null,
    durationSec,
    distance,
    activeTimeGoalSec,
    activeGoalCompletion: completion as number | null,
    activeTimeZones: data["active-time-zones"] ?? null,
    inactivityStamps: data["inactivity-stamps"] ?? null,
    raw: data,
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
      });
    } catch (e) {
      console.error("[push] step goal notification failed:", e);
    }
  }
}
