/**
 * CLI to import a Polar GDPR user-data-export folder into flux.
 *
 *   tsx --env-file=.env.local scripts/import-polar-export.ts \
 *     --dir=<path-to-export-folder> \
 *     --month=YYYY-MM \
 *     --email=<user-email> \
 *     [--dry-run]
 *
 * Imports two kinds of files filtered by month:
 *   - training-session-YYYY-MM-*.json → activities
 *   - activity-YYYY-MM-*.json         → dailyActivity
 *
 * Idempotent via unique `activities.polar_id` and upsert on
 * `(dailyActivity.userId, dailyActivity.date)`.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { and, eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, activities, deletedPolarActivities, dailyActivity } from "../src/lib/db/schema";
import { parseTrainingSession, parseDailyActivity } from "../src/lib/polar-export-parser";
import { computeTrimp, type Sex } from "../src/lib/trimp";
import { generateActivityTitle } from "../src/lib/ai-title";

interface Args {
  dir: string;
  month: string;
  email: string;
  dryRun: boolean;
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      month: { type: "string" },
      email: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const dir = values.dir;
  const month = values.month;
  const email = values.email;
  if (!dir || !month || !email) {
    console.error(
      "Usage: tsx --env-file=.env.local scripts/import-polar-export.ts \\\n" +
        "  --dir=<path> --month=YYYY-MM --email=<email> [--dry-run]"
    );
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error(`Invalid --month=${month}, expected YYYY-MM`);
    process.exit(1);
  }
  return { dir, month, email, dryRun: !!values["dry-run"] };
}

async function main() {
  const { dir, month, email, dryRun } = parseCliArgs();

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`✓ user resolved: ${user.email} (${user.id})`);
  console.log(`✓ month filter: ${month}`);
  console.log(`✓ dir:          ${dir}`);
  if (dryRun) console.log("✓ DRY RUN — no DB writes");
  console.log("");

  const allFiles = readdirSync(dir);
  const trainingFiles = allFiles.filter(
    (f) => f.startsWith(`training-session-${month}-`) && f.endsWith(".json")
  );
  const dailyFiles = allFiles.filter(
    (f) => f.startsWith(`activity-${month}-`) && f.endsWith(".json")
  );

  console.log(
    `Found ${trainingFiles.length} training-session + ${dailyFiles.length} daily-activity files`
  );
  console.log("");

  // ── Trainings ────────────────────────────────────────────────────────────
  let tImported = 0;
  let tSkipped = 0;
  let tBlacklisted = 0;
  let tFailed = 0;

  for (const file of trainingFiles) {
    const path = join(dir, file);
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const parsed = parseTrainingSession(raw);
      if (!parsed) {
        console.log(`  ✗ parse failed: ${file}`);
        tFailed++;
        continue;
      }

      // Skip tiny sessions (accidentally started/stopped on the watch).
      // Indoor sessions (no GPS, distance null/0) bypass the distance check.
      const MIN_DURATION_SEC = 300;
      const MIN_DISTANCE_M = 500;
      const tooShort = (parsed.durationSec ?? 0) < MIN_DURATION_SEC;
      const hasRecordedDistance =
        parsed.distanceMeters != null && parsed.distanceMeters > 0;
      const tooSmall =
        hasRecordedDistance && (parsed.distanceMeters as number) < MIN_DISTANCE_M;
      if (tooShort || tooSmall) {
        console.log(
          `  → SKIP   ${parsed.polarId}  ${isoDate(parsed.startTime)}  (mini session: ${Math.round((parsed.durationSec ?? 0) / 60)}min / ${fmtMeters(parsed.distanceMeters)})`
        );
        tSkipped++;
        continue;
      }

      const existing = await db.query.activities.findFirst({
        where: eq(activities.polarId, parsed.polarId),
      });
      if (existing) {
        console.log(
          `  → SKIP   ${parsed.polarId}  ${isoDate(parsed.startTime)}  (already imported)`
        );
        tSkipped++;
        continue;
      }

      const blacklisted = await db.query.deletedPolarActivities.findFirst({
        where: and(
          eq(deletedPolarActivities.polarId, parsed.polarId),
          eq(deletedPolarActivities.userId, user.id)
        ),
      });
      if (blacklisted) {
        console.log(
          `  → SKIP   ${parsed.polarId}  ${isoDate(parsed.startTime)}  (blacklisted)`
        );
        tBlacklisted++;
        continue;
      }

      const trimp = computeTrimp(
        {
          sex: user.sex as Sex,
          birthday: user.birthday,
          maxHeartRate: user.maxHeartRate,
          restHeartRate: user.restHeartRate,
        },
        {
          avgHeartRate: parsed.hrAvg,
          maxHeartRate: parsed.hrMax,
          duration: parsed.durationSec,
        },
        parsed.heartRateData
      );

      const fallbackTitle = `${humanizeType(parsed.type)} ${fmtDate(parsed.startTime)}`;
      let name = fallbackTitle;
      try {
        name = await generateActivityTitle({
          type: parsed.type,
          subType: null,
          startTime: parsed.startTime,
          distanceMeters: parsed.distanceMeters,
          durationSeconds: parsed.durationSec,
          ascentMeters: parsed.ascent,
          routeData: parsed.routeData,
          fallbackTitle,
        });
      } catch (e) {
        console.warn(`    ⚠ AI title failed, using fallback: ${errMsg(e)}`);
      }

      const row = {
        polarId: parsed.polarId,
        userId: user.id,
        name,
        type: parsed.type,
        startTime: parsed.startTime,
        duration: parsed.durationSec,
        distance: parsed.distanceMeters,
        calories: parsed.calories,
        avgHeartRate: parsed.hrAvg,
        maxHeartRate: parsed.hrMax,
        ascent: parsed.ascent,
        descent: parsed.descent,
        routeData: parsed.routeData,
        heartRateData: parsed.heartRateData,
        speedData: parsed.speedData,
        fatPercentage: parsed.fatPercentage,
        carbPercentage: parsed.carbPercentage,
        proteinPercentage: parsed.proteinPercentage,
        minAltitude: parsed.minAltitude,
        maxAltitude: parsed.maxAltitude,
        cardioLoad: parsed.cardioLoad,
        cardioLoadInterpretation: parsed.cardioLoadInterpretation,
        trimp,
        device: parsed.device,
      };

      if (dryRun) {
        console.log(
          `  ✓ would insert  ${parsed.polarId}  ${isoDate(parsed.startTime)}  ${parsed.type}  ${fmtMeters(parsed.distanceMeters)}  trimp=${trimp ?? "-"}`
        );
      } else {
        await db.insert(activities).values(row);
        console.log(
          `  ✓ IMPORT ${parsed.polarId}  ${isoDate(parsed.startTime)}  ${parsed.type}  ${fmtMeters(parsed.distanceMeters)}  "${name}"`
        );
      }
      tImported++;
    } catch (e) {
      console.error(`  ✗ ERROR ${file}: ${errMsg(e)}`);
      tFailed++;
    }
  }

  // ── Daily activities ─────────────────────────────────────────────────────
  let dImported = 0;
  let dUpdated = 0;
  let dFailed = 0;

  for (const file of dailyFiles) {
    const path = join(dir, file);
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const parsed = parseDailyActivity(raw);
      if (!parsed) {
        console.log(`  ✗ parse failed: ${file}`);
        dFailed++;
        continue;
      }

      const existing = await db.query.dailyActivity.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.userId, user.id), eq(t.date, parsed.date)),
      });

      const values = {
        userId: user.id,
        date: parsed.date,
        polarActivityId: null,
        steps: parsed.steps,
        activeSteps: null,
        calories: parsed.calories,
        activeCalories: null,
        durationSec: parsed.durationSec,
        distance: parsed.distance,
        activeTimeGoalSec: null,
        activeGoalCompletion: null,
        activeTimeZones: parsed.activeTimeZones,
        inactivityStamps: null,
        raw: parsed.raw,
        updatedAt: new Date(),
      };

      if (dryRun) {
        const action = existing ? "UPDATE" : "INSERT";
        console.log(
          `  ✓ would ${action.toLowerCase()}  ${parsed.date}  steps=${parsed.steps ?? "-"}  dur=${parsed.durationSec ?? "-"}s`
        );
      } else if (existing) {
        await db
          .update(dailyActivity)
          .set(values)
          .where(eq(dailyActivity.id, existing.id));
        console.log(
          `  ↻ UPDATE ${parsed.date}  steps=${parsed.steps ?? "-"}`
        );
        dUpdated++;
        continue;
      } else {
        await db.insert(dailyActivity).values(values);
        console.log(
          `  ✓ INSERT ${parsed.date}  steps=${parsed.steps ?? "-"}`
        );
      }
      dImported++;
    } catch (e) {
      console.error(`  ✗ ERROR ${file}: ${errMsg(e)}`);
      dFailed++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("");
  console.log("════════════════════════════════════════");
  console.log(`Trainings         : ${tImported} imported, ${tSkipped} skipped, ${tBlacklisted} blacklisted, ${tFailed} failed`);
  console.log(`Daily activities  : ${dImported} inserted, ${dUpdated} updated, ${dFailed} failed`);
  if (dryRun) console.log("(DRY RUN — nothing was written)");
  console.log("════════════════════════════════════════");
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMeters(m: number | null): string {
  if (m == null) return "-";
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

function humanizeType(t: string): string {
  const map: Record<string, string> = {
    RUNNING: "Lauf",
    CYCLING: "Radtour",
    MOUNTAIN_BIKING: "MTB",
    ROAD_BIKING: "Rennrad",
    HIKING: "Wanderung",
    WALKING: "Spaziergang",
    TRAIL_RUNNING: "Trail",
    SWIMMING: "Schwimmen",
  };
  return map[t] ?? t;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
