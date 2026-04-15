import { NextRequest, NextResponse } from "next/server";
import { validateWebhookSignature, listExercises, downloadFit, parsePolarStartTime } from "@/lib/polar-client";
import { parseFitFile } from "@/lib/fit-parser";
import { computeTrimp, type Sex } from "@/lib/trimp";
import { generateActivityTitle, normalizePolarType } from "@/lib/ai-title";
import { db } from "@/lib/db";
import { users, activities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { evaluateTrophies } from "@/lib/trophies-server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("Polar-Webhook-Signature") ?? "";

  // Skip signature validation if no webhook secret is configured yet
  if (process.env.POLAR_WEBHOOK_SECRET) {
    const valid = await validateWebhookSignature(body, signature);
    if (!valid) {
      console.warn("Webhook signature invalid");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(body);
  console.log("Polar webhook received:", payload);

  if (payload.event === "EXERCISE") {
    // Find user by Polar user ID
    const polarUserId = String(payload.user_id);
    const user = await db.query.users.findFirst({
      where: eq(users.polarUserId, polarUserId),
    });

    if (!user || !user.polarToken) {
      console.warn("No user found for Polar user ID:", polarUserId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
      const exercises = await listExercises(user.polarToken);
      let synced = 0;

      for (const exercise of exercises) {
        const existing = await db.query.activities.findFirst({
          where: eq(activities.polarId, exercise.id),
        });
        if (existing) continue;

        let routeData = null;
        let heartRateData = null;
        let speedData = null;
        let fitFilePath: string | null = null;
        let fitSession: any = null;

        try {
          const fitBuffer = await downloadFit(user.polarToken, exercise.id);
          const fitDir = join(process.env.FIT_FILES_PATH || "./data/fit-files", user.id);
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

        await db.insert(activities).values({
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
        });
        synced++;
      }

      if (synced > 0) {
        try {
          const unlocked = await evaluateTrophies(user.id);
          if (unlocked.length > 0) {
            console.log(
              `Unlocked trophies for user ${user.name}: ${unlocked.join(", ")}`
            );
          }
        } catch (e) {
          console.error("Trophy evaluation error:", e);
        }
      }

      console.log(`Webhook sync complete: ${synced} new activities for user ${user.name}`);
    } catch (e) {
      console.error("Webhook sync error:", e);
    }
  }

  return NextResponse.json({ received: true });
}
