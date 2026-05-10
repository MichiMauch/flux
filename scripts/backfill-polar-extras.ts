/**
 * Backfill /v3/users/physical-info into the user record + dailyPolarExtras
 * (cardio-load, continuous-HR, sleep-wise, body/skin temp, spo2, ecg) for
 * existing daily_activity rows.
 *
 * Direct-DB version (avoids importing route files which pull `server-only`).
 *
 * Run: npx tsx scripts/backfill-polar-extras.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const SLEEP_MS = 500;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { dailyActivity, dailyPolarExtras, users } = await import(
    "../src/lib/db/schema"
  );
  const { eq, isNotNull, and, gte } = await import("drizzle-orm");
  const {
    getPhysicalInfo,
    listCardioLoad,
    getContinuousHeartRate,
    getSleepWiseAlertness,
    getSleepWiseCircadianBedtime,
    getBodyTemperature,
    getSkinTemperature,
    getSkinContacts,
    getSpo2,
    getWristEcg,
    parseIsoDuration,
  } = await import("../src/lib/polar-client");

  const userRows = await db
    .select({ id: users.id, polarToken: users.polarToken })
    .from(users)
    .where(isNotNull(users.polarToken));

  // 1) Physical info — once per user.
  for (const u of userRows) {
    if (!u.polarToken) continue;
    try {
      const info = await getPhysicalInfo(u.polarToken);
      if (!info) {
        console.log(`[physical-info] user=${u.id}: no data`);
        continue;
      }
      const updates: Record<string, unknown> = {
        physicalInfoSyncedAt: new Date(),
      };
      if (typeof info.weight === "number") updates.weightKg = info.weight;
      if (typeof info.height === "number") {
        updates.heightCm = Math.round(info.height);
      }
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
      if (typeof info.training_background === "string") {
        updates.trainingBackground = info.training_background;
      }
      if (typeof info.typical_day === "string") {
        updates.typicalDay = info.typical_day;
      }
      const sleepGoalSec = parseIsoDuration(info.sleep_goal);
      if (sleepGoalSec != null) updates.sleepGoalSec = sleepGoalSec;
      await db.update(users).set(updates).where(eq(users.id, u.id));
      console.log(
        `[physical-info] user=${u.id}: synced (vo2=${info.vo2_max}, weight=${info.weight}, maxHR=${info.maximum_heart_rate})`,
      );
    } catch (e) {
      console.warn(`[physical-info] user=${u.id} failed:`, e);
    }
    await sleep(SLEEP_MS);
  }

  // 2) Daily extras — last 90 days.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const dayRows = await db
    .select({
      userId: dailyActivity.userId,
      date: dailyActivity.date,
      polarToken: users.polarToken,
    })
    .from(dailyActivity)
    .innerJoin(users, eq(users.id, dailyActivity.userId))
    .where(
      and(
        isNotNull(users.polarToken),
        gte(dailyActivity.date, cutoffIso),
      ),
    );

  console.log(`[extras] backfilling ${dayRows.length} (user, date) pairs`);

  // Cache cardio-load list per user (returns ~28 days).
  const cardioCache = new Map<
    string,
    Array<Record<string, unknown>>
  >();

  let ok = 0;
  let failed = 0;
  for (const r of dayRows) {
    if (!r.polarToken) continue;
    try {
      // Track per-user whether cardio-load is fetched OK (so we don't
      // overwrite existing good data with nulls when the API rate-limits).
      let cardioList = cardioCache.get(r.userId);
      let cardioFetchOk = true;
      if (!cardioList) {
        try {
          cardioList = (await listCardioLoad(r.polarToken)) as Array<
            Record<string, unknown>
          >;
          cardioCache.set(r.userId, cardioList);
        } catch (e) {
          console.warn(`  cardio-load list failed: ${e}`);
          cardioFetchOk = false;
          cardioList = [];
          // Don't cache failure — retry next iteration in case rate limit
          // clears mid-run. But the per-day cost is one extra failed request.
        }
      }
      const cardioDay =
        cardioList?.find((d) => d.date === r.date) ?? null;
      const cl = cardioDay as Record<string, unknown> | null;

      const [
        continuousHr,
        alertness,
        circadianBedtime,
        bodyTemp,
        skinTemp,
        skinContacts,
        ecg,
        spo2,
      ] = await Promise.all([
        getContinuousHeartRate(r.polarToken, r.date).catch(() => null),
        getSleepWiseAlertness(r.polarToken).catch(() => null),
        getSleepWiseCircadianBedtime(r.polarToken).catch(() => null),
        getBodyTemperature(r.polarToken, r.date, r.date).catch(() => null),
        getSkinTemperature(r.polarToken, r.date, r.date).catch(() => null),
        getSkinContacts(r.polarToken, r.date, r.date).catch(() => null),
        getWristEcg(r.polarToken, r.date, r.date).catch(() => null),
        getSpo2(r.polarToken, r.date, r.date).catch(() => null),
      ]);

      const hr = continuousHr as { heart_rate_samples?: unknown } | null;

      const existing = await db.query.dailyPolarExtras.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.userId, r.userId), eq(t.date, r.date)),
      });

      // Build the update — only include cardio-load fields when we
      // successfully fetched the list. Otherwise leave existing values.
      const values: typeof dailyPolarExtras.$inferInsert & Record<
        string,
        unknown
      > = {
        userId: r.userId,
        date: r.date,
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

      if (cardioFetchOk) {
        values.cardioLoad =
          typeof cl?.cardio_load === "number"
            ? (cl.cardio_load as number)
            : null;
        values.cardioLoadStatus =
          typeof cl?.cardio_load_status === "string"
            ? (cl.cardio_load_status as string)
            : null;
        values.cardioLoadStrain =
          typeof cl?.strain === "number" ? (cl.strain as number) : null;
        values.cardioLoadTolerance =
          typeof cl?.tolerance === "number" ? (cl.tolerance as number) : null;
        values.cardioLoadRatio =
          typeof cl?.cardio_load_ratio === "number"
            ? (cl.cardio_load_ratio as number)
            : null;
        values.cardioLoadLevel = cl?.cardio_load_level ?? null;
        values.cardioLoadRaw = cardioDay ?? null;
      }

      if (existing) {
        await db
          .update(dailyPolarExtras)
          .set(values)
          .where(eq(dailyPolarExtras.id, existing.id));
      } else {
        await db.insert(dailyPolarExtras).values(values);
      }

      ok++;
      if (ok % 10 === 0) {
        console.log(
          `  ${ok}/${dayRows.length} ${r.date} cardioLoad=${cl?.cardio_load ?? "-"} hrSamples=${(hr?.heart_rate_samples as unknown[] | undefined)?.length ?? 0}`,
        );
      }
    } catch (e) {
      failed++;
      console.warn(`  ${r.date}  ✗ ${e instanceof Error ? e.message : e}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(`\nDone. extras_ok=${ok}  failed=${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
