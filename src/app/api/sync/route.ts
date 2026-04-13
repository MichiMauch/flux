import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, activities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listExercises, downloadFit } from "@/lib/polar-client";
import { parseFitFile } from "@/lib/fit-parser";
import { computeTrimp, type Sex } from "@/lib/trimp";
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

      // Download and parse FIT file
      let routeData = null;
      let heartRateData = null;
      let speedData = null;
      let fitFilePath: string | null = null;

      try {
        const fitBuffer = await downloadFit(user.polarToken, exercise.id);

        // Archive FIT file
        const fitDir = join(
          process.env.FIT_FILES_PATH || "./data/fit-files",
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

      // Insert activity
      await db.insert(activities).values({
        polarId: exercise.id,
        userId: user.id,
        name: exercise.detailed_sport_info || exercise.sport || "Training",
        type: exercise.sport || "OTHER",
        startTime: new Date(exercise.start_time),
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

    return NextResponse.json({ synced, total: exercises.length });
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
