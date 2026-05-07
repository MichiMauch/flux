import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature, listExercises, downloadFit, parsePolarStartTime } from "@/lib/polar-client";
import { parseFitFile } from "@/lib/fit-parser";
import { computeTrimp, type Sex } from "@/lib/trimp";
import { generateActivityTitle, normalizePolarType } from "@/lib/ai-title";
import { buildRouteGeometry } from "@/lib/activities/route-geometry";
import { reverseGeocodeStructured } from "@/lib/geocode";
import { db } from "@/lib/db";
import { users, activities, deletedPolarActivities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { evaluateTrophies } from "@/lib/trophies-server";
import { TROPHIES } from "@/lib/trophies";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncSleep } from "@/app/api/sync/sleep/route";
import { sendPushToUser, sendActivityPushes } from "@/lib/push";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("Polar-Webhook-Signature") ?? "";

  if (!process.env.POLAR_WEBHOOK_SECRET) {
    console.error("POLAR_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }
  const valid = await validateWebhookSignature(body, signature);
  if (!valid) {
    console.warn("Webhook signature invalid");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);
  console.log("Polar webhook received:", payload);

  const event: string | undefined = payload.event;

  // PING is sent by Polar when registering/verifying a webhook — just ack.
  if (event === "PING") {
    return NextResponse.json({ received: true });
  }

  const polarUserId = String(payload.user_id);
  const user = await db.query.users.findFirst({
    where: eq(users.polarUserId, polarUserId),
  });

  if (!user || !user.polarToken) {
    console.warn("No user found for Polar user ID:", polarUserId);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (event === "EXERCISE") {
      await handleExerciseEvent(user);
    } else if (event === "ACTIVITY_SUMMARY") {
      if (!user.polarUserId) {
        console.warn("[webhook] ACTIVITY_SUMMARY: user has no polarUserId, skipping");
      } else {
        const synced = await syncDailyActivity(user.id, user.polarToken, user.polarUserId);
        console.log(`[webhook] ACTIVITY_SUMMARY: ${synced} days synced for ${user.name}`);
      }
    } else if (event === "SLEEP") {
      const result = await syncSleep(user.id, user.polarToken);
      console.log(
        `[webhook] SLEEP: ${result.sleepSynced} sleep / ${result.nightsSynced} nights synced for ${user.name}`
      );
    } else {
      console.log(`[webhook] unhandled event type: ${event}`);
    }
  } catch (e) {
    console.error(`[webhook] ${event} handler error:`, e);
  }

  return NextResponse.json({ received: true });
}

async function handleExerciseEvent(user: typeof users.$inferSelect): Promise<void> {
  if (!user.polarToken) return;

  const exercises = await listExercises(user.polarToken);
  let synced = 0;

  for (const exercise of exercises) {
    const existing = await db.query.activities.findFirst({
      where: eq(activities.polarId, exercise.id),
    });
    if (existing) continue;

    const blacklisted = await db.query.deletedPolarActivities.findFirst({
      where: and(
        eq(deletedPolarActivities.polarId, exercise.id),
        eq(deletedPolarActivities.userId, user.id)
      ),
    });
    if (blacklisted) continue;

    let routeData = null;
    let heartRateData = null;
    let speedData = null;
    let fitFilePath: string | null = null;
    let fitSession: any = null;

    try {
      const fitBuffer = await downloadFit(user.polarToken, exercise.id);
      const fitDir = join(process.env.FIT_FILES_PATH || "/data/fit-files", user.id);
      await mkdir(fitDir, { recursive: true });
      fitFilePath = join(fitDir, `${exercise.id}.fit`);
      await writeFile(fitFilePath, Buffer.from(fitBuffer));

      const parsed = await parseFitFile(fitBuffer);
      routeData = parsed.routeData.length > 0 ? parsed.routeData : null;
      heartRateData = parsed.heartRateData.length > 0 ? parsed.heartRateData : null;
      speedData = parsed.speedData.length > 0 ? parsed.speedData : null;
      fitSession = parsed.session;
    } catch (e) {
      console.warn(`Could not process FIT for ${exercise.id}:`, e);
    }

    const durationMatch = exercise.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
    const durationSeconds = durationMatch
      ? (parseInt(durationMatch[1] || "0") * 3600 +
         parseInt(durationMatch[2] || "0") * 60 +
         Math.round(parseFloat(durationMatch[3] || "0")))
      : 0;

    const avgHr = exercise.heart_rate?.average ?? fitSession?.avgHeartRate ?? null;
    const maxHr = exercise.heart_rate?.maximum ?? fitSession?.maxHeartRate ?? null;
    const trimp = computeTrimp(
      {
        sex: user.sex as Sex,
        birthday: user.birthday,
        maxHeartRate: user.maxHeartRate,
        restHeartRate: user.restHeartRate,
      },
      { avgHeartRate: avgHr, maxHeartRate: maxHr, duration: durationSeconds },
      heartRateData as { time: string; bpm: number }[] | null
    );

    const normalizedType = normalizePolarType(exercise.sport, exercise.detailed_sport_info);
    const fallbackName = exercise.detailed_sport_info || exercise.sport || "Training";
    const startTime = parsePolarStartTime(exercise.start_time, exercise.start_time_utc_offset);
    const aiName = await generateActivityTitle({
      type: normalizedType,
      subType: exercise.detailed_sport_info ?? null,
      startTime,
      distanceMeters: exercise.distance ?? null,
      durationSeconds,
      ascentMeters: fitSession?.totalAscent ?? null,
      routeData: routeData as { lat: number; lng: number; time?: string }[] | null,
      fallbackTitle: fallbackName,
    });

    // Reverse-Geocode (best effort — bei Failure NULL, Backfill kann später nachholen)
    let locality: string | null = null;
    let country: string | null = null;
    let geocodedAt: Date | null = null;
    const startPoint = (routeData as { lat: number; lng: number }[] | null)?.[0];
    if (startPoint && typeof startPoint.lat === "number" && typeof startPoint.lng === "number") {
      const loc = await reverseGeocodeStructured(startPoint.lat, startPoint.lng);
      if (loc) {
        locality = loc.locality;
        country = loc.country;
        geocodedAt = new Date();
      }
    }

    const [inserted] = await db
      .insert(activities)
      .values({
        polarId: exercise.id,
        userId: user.id,
        name: aiName,
        type: normalizedType,
        startTime,
        duration: durationSeconds,
        movingTime: fitSession?.movingTime ?? null,
        distance: exercise.distance,
        calories: exercise.calories,
        avgHeartRate: avgHr,
        maxHeartRate: maxHr,
        ascent: fitSession?.totalAscent ?? null,
        descent: fitSession?.totalDescent ?? null,
        routeData,
        routeGeometry: buildRouteGeometry(routeData),
        heartRateData,
        speedData,
        minAltitude: fitSession?.minAltitude ?? null,
        maxAltitude: fitSession?.maxAltitude ?? null,
        avgCadence: fitSession?.avgCadence ?? null,
        maxCadence: fitSession?.maxCadence ?? null,
        totalSteps: fitSession?.totalSteps ?? null,
        avgSpeed: fitSession?.avgSpeed ?? null,
        maxSpeed: fitSession?.maxSpeed ?? null,
        fatPercentage: exercise.fat_percentage ?? null,
        carbPercentage: exercise.carbohydrate_percentage ?? null,
        proteinPercentage: exercise.protein_percentage ?? null,
        cardioLoad: exercise.training_load_pro?.["cardio-load"] ?? null,
        cardioLoadInterpretation: exercise.training_load_pro?.["cardio-load-interpretation"] ?? null,
        trimp,
        device: exercise.device ?? null,
        fitFilePath,
        locality,
        country,
        geocodedAt,
      })
      .returning({ id: activities.id });

    synced++;

    if (inserted) {
      try {
        await sendActivityPushes(
          { id: user.id, name: user.name, partnerId: user.partnerId },
          {
            activityId: inserted.id,
            polarId: exercise.id,
            name: aiName,
            distance: exercise.distance ?? null,
            durationSec: durationSeconds,
          }
        );
      } catch (e) {
        console.error("[push] activity notification failed:", e);
      }
    }
  }

  if (synced > 0) {
    try {
      const unlocked = await evaluateTrophies(user.id);
      if (unlocked.length > 0) {
        console.log(
          `Unlocked trophies for user ${user.name}: ${unlocked.join(", ")}`
        );
        for (const code of unlocked) {
          const def = TROPHIES.find((t) => t.code === code);
          if (!def) continue;
          try {
            await sendPushToUser(user.id, {
              title: "Trophy freigeschaltet",
              body: `${def.title} — ${def.description}`,
              url: "/trophies",
              tag: `trophy-${code}`,
              kind: "trophy",
            });
          } catch (e) {
            console.error("[push] trophy notification failed:", e);
          }
        }
      }
    } catch (e) {
      console.error("Trophy evaluation error:", e);
    }
  }

  console.log(`[webhook] EXERCISE: ${synced} new activities for user ${user.name}`);
}
