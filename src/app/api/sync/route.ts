import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, activities, deletedPolarActivities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { listExercises, downloadFit, parsePolarStartTime } from "@/lib/polar-client";
import { parseFitFile } from "@/lib/fit-parser";
import { computeTrimp, type Sex } from "@/lib/trimp";
import { generateActivityTitle, normalizePolarType } from "@/lib/ai-title";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncSleep } from "@/app/api/sync/sleep/route";
import { evaluateTrophies } from "@/lib/trophies-server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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
    const exercises = await listExercises(user.polarToken);
    let synced = 0;

    for (const exercise of exercises) {
      // Check if already synced
      const existing = await db.query.activities.findFirst({
        where: eq(activities.polarId, exercise.id),
      });
      if (existing) continue;

      // Skip if user has deleted this activity before
      const blacklisted = await db.query.deletedPolarActivities.findFirst({
        where: and(
          eq(deletedPolarActivities.polarId, exercise.id),
          eq(deletedPolarActivities.userId, user.id)
        ),
      });
      if (blacklisted) continue;

      // Download and parse FIT file
      let routeData = null;
      let heartRateData = null;
      let speedData = null;
      let fitFilePath: string | null = null;

      try {
        const fitBuffer = await downloadFit(user.polarToken, exercise.id);

        // Archive FIT file
        const fitDir = join(
          process.env.FIT_FILES_PATH || "/data/fit-files",
          user.id
        );
        await mkdir(fitDir, { recursive: true });
        fitFilePath = join(fitDir, `${exercise.id}.fit`);
        await writeFile(fitFilePath, Buffer.from(fitBuffer));

        // Parse FIT data
        const parsed = await parseFitFile(fitBuffer);
        routeData = parsed.routeData.length > 0 ? parsed.routeData : null;
        heartRateData =
          parsed.heartRateData.length > 0 ? parsed.heartRateData : null;
        speedData = parsed.speedData.length > 0 ? parsed.speedData : null;
      } catch (e) {
        console.warn(`Could not process FIT for ${exercise.id}:`, e);
      }

      // Parse duration (ISO 8601 duration: PT1H30M45S)
      const durationSeconds = parseDuration(exercise.duration);

      const trimp = computeTrimp(
        {
          sex: user.sex as Sex,
          birthday: user.birthday,
          maxHeartRate: user.maxHeartRate,
          restHeartRate: user.restHeartRate,
        },
        {
          avgHeartRate: exercise.heart_rate?.average ?? null,
          maxHeartRate: exercise.heart_rate?.maximum ?? null,
          duration: durationSeconds,
        },
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
        durationSeconds: durationSeconds,
        ascentMeters: null,
        routeData: routeData as { lat: number; lng: number; time?: string }[] | null,
        fallbackTitle: fallbackName,
      });

      // Insert activity
      await db.insert(activities).values({
        polarId: exercise.id,
        userId: user.id,
        name: aiName,
        type: normalizedType,
        startTime,
        duration: durationSeconds,
        distance: exercise.distance,
        calories: exercise.calories,
        avgHeartRate: exercise.heart_rate?.average,
        maxHeartRate: exercise.heart_rate?.maximum,
        routeData,
        heartRateData,
        speedData,
        fatPercentage: exercise.fat_percentage ?? null,
        carbPercentage: exercise.carbohydrate_percentage ?? null,
        proteinPercentage: exercise.protein_percentage ?? null,
        cardioLoad: exercise.training_load_pro?.["cardio-load"] ?? null,
        cardioLoadInterpretation: exercise.training_load_pro?.["cardio-load-interpretation"] ?? null,
        trimp,
        device: exercise.device ?? null,
        fitFilePath,
      });

      synced++;
    }

    let unlockedTrophies: string[] = [];
    if (synced > 0) {
      try {
        unlockedTrophies = await evaluateTrophies(user.id);
      } catch (e) {
        console.error("Trophy evaluation error:", e);
      }
    }

    // Daily activity (best effort)
    let dailySynced = 0;
    if (user.polarUserId) {
      try {
        dailySynced = await syncDailyActivity(user.id, user.polarToken, user.polarUserId);
      } catch (e) {
        console.error("Daily activity sync failed:", e);
      }
    } else {
      console.warn("[sync] skipping daily: user has no polarUserId");
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

    return NextResponse.json({
      synced,
      dailySynced,
      sleepSynced,
      nightsSynced,
      total: exercises.length,
      unlockedTrophies,
    });
  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Sync fehlgeschlagen", details: message },
      { status: 500 }
    );
  }
}

function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = Math.round(parseFloat(match[3] || "0"));
  return hours * 3600 + minutes * 60 + seconds;
}
