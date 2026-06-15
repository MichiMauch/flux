/**
 * Shared Polar exercise → activity sync.
 *
 * One implementation used by all three trigger paths so they never drift:
 *   - the EXERCISE webhook (src/app/api/polar/webhook/route.ts)
 *   - the manual Sync button (src/app/api/sync/route.ts)
 *   - the scheduled backup cron (src/app/api/cron/polar-sync/route.ts)
 *
 * Pulls available exercises via /v3/exercises, inserts any that are new (and
 * not user-deleted), archives the FIT file, sends push notifications, and
 * evaluates trophies. Idempotent: activities.polar_id is UNIQUE and deleted
 * activities are blacklisted, so re-running (e.g. cron after a webhook already
 * handled an item) is a no-op.
 *
 * Throws PolarAuthError if the user's token is rejected (401/403) — callers
 * decide how to surface "reconnect Polar".
 */

import { listExercises, downloadFit, parsePolarStartTime } from "@/lib/polar-client";
import { parseFitFile } from "@/lib/fit-parser";
import { computeTrimp, type Sex } from "@/lib/trimp";
import { generateActivityTitle, normalizePolarType } from "@/lib/ai-title";
import { buildRouteGeometry } from "@/lib/activities/route-geometry";
import { revalidateTag } from "next/cache";
import { homeCacheTag } from "@/lib/cache/home-stats";
import { reverseGeocodeStructured } from "@/lib/geocode";
import { db } from "@/lib/db";
import { users, activities, deletedPolarActivities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { evaluateTrophies } from "@/lib/trophies-server";
import { TROPHIES } from "@/lib/trophies";
import { sendPushToUser, sendActivityPushes } from "@/lib/push";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface PolarSyncResult {
  synced: number;
  unlockedTrophies: string[];
}

export async function syncPolarExercises(
  user: typeof users.$inferSelect
): Promise<PolarSyncResult> {
  if (!user.polarToken) return { synced: 0, unlockedTrophies: [] };

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // A FIT auth failure means the whole token is dead — let it propagate.
      // (downloadFit throws PolarAuthError on 401/403.)
      if (e instanceof Error && e.name === "PolarAuthError") throw e;
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

  let unlockedTrophies: string[] = [];
  if (synced > 0) {
    try {
      unlockedTrophies = await evaluateTrophies(user.id);
      if (unlockedTrophies.length > 0) {
        console.log(
          `Unlocked trophies for user ${user.name}: ${unlockedTrophies.join(", ")}`
        );
        for (const code of unlockedTrophies) {
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

    revalidateTag(homeCacheTag(user.id), "default");
  }

  console.log(`[polar-sync] EXERCISE: ${synced} new activities for user ${user.name}`);
  return { synced, unlockedTrophies };
}
