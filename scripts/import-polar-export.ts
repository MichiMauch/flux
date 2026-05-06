/**
 * CLI to import a Polar GDPR user-data-export folder into flux.
 *
 *   tsx --env-file=.env.local scripts/import-polar-export.ts \
 *     --dir=<path-to-export-folder> --email=<user-email> \
 *     ( --month=YYYY-MM | [--from=YYYY-MM-DD] [--until=YYYY-MM-DD] ) \
 *     [--types=HIKING,WALKING,CYCLING,...] [--collapse-cycling] \
 *     [--no-daily] [--analyze | --dry-run]
 *
 * Imports two kinds of files filtered by date range:
 *   - training-session-YYYY-MM-DDT…json → activities
 *   - activity-YYYY-MM-DD-…json         → dailyActivity (off with --no-daily)
 *
 * Idempotent via unique `activities.polar_id` and upsert on
 * `(dailyActivity.userId, dailyActivity.date)`.
 *
 * See scripts/import-polar-export.md for the full flag reference.
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
  month: string | null;
  from: string | null;
  until: string | null;
  email: string;
  types: Set<string> | null;
  collapseCycling: boolean;
  noDaily: boolean;
  analyze: boolean;
  dryRun: boolean;
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      dir: { type: "string" },
      month: { type: "string" },
      from: { type: "string" },
      until: { type: "string" },
      email: { type: "string" },
      types: { type: "string" },
      "collapse-cycling": { type: "boolean", default: false },
      "no-daily": { type: "boolean", default: false },
      analyze: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const dir = values.dir;
  const email = values.email;
  const month = values.month ?? null;
  const from = values.from ?? null;
  const until = values.until ?? null;
  if (!dir || !email) {
    console.error(
      "Usage: tsx --env-file=.env.local scripts/import-polar-export.ts \\\n" +
        "  --dir=<path> --email=<email>\n" +
        "  [--month=YYYY-MM | --from=YYYY-MM-DD --until=YYYY-MM-DD]\n" +
        "  [--types=HIKING,WALKING,CYCLING,...] [--collapse-cycling]\n" +
        "  [--no-daily] [--analyze | --dry-run]"
    );
    process.exit(1);
  }
  if (!month && !from && !until) {
    console.error("Provide either --month=YYYY-MM or a date range via --from/--until");
    process.exit(1);
  }
  if (month && (from || until)) {
    console.error("--month is exclusive with --from/--until");
    process.exit(1);
  }
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    console.error(`Invalid --month=${month}, expected YYYY-MM`);
    process.exit(1);
  }
  for (const [k, v] of [["from", from] as const, ["until", until] as const]) {
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      console.error(`Invalid --${k}=${v}, expected YYYY-MM-DD`);
      process.exit(1);
    }
  }
  let typesSet: Set<string> | null = null;
  if (typeof values.types === "string" && values.types.trim()) {
    typesSet = new Set(
      values.types
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    );
  }
  return {
    dir,
    month,
    from,
    until,
    email,
    types: typesSet,
    collapseCycling: !!values["collapse-cycling"],
    noDaily: !!values["no-daily"],
    analyze: !!values.analyze,
    dryRun: !!values["dry-run"],
  };
}

const CYCLING_SUBTYPES = new Set([
  "ROAD_BIKING",
  "MOUNTAIN_BIKING",
  "GRAVEL_RIDING",
  "EBIKE_RIDE",
]);

function collapseCyclingType(t: string): string {
  return CYCLING_SUBTYPES.has(t) ? "CYCLING" : t;
}

/**
 * Extract YYYY-MM-DD from a "training-session-YYYY-MM-DDT..." or
 * "activity-YYYY-MM-DD-..." filename. Returns null if it doesn't match.
 */
function dateFromFilename(file: string): string | null {
  const m = file.match(/^(?:training-session-|activity-)(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

async function main() {
  const args = parseCliArgs();
  const { dir, month, from, until, email, types, collapseCycling, noDaily, analyze, dryRun } =
    args;

  // Resolve user only when we'll actually need DB. Analyze mode skips DB entirely.
  let user: typeof users.$inferSelect | null = null;
  if (!analyze) {
    const u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!u) {
      console.error(`No user found with email ${email}`);
      process.exit(1);
    }
    user = u;
    console.log(`✓ user resolved: ${user.email} (${user.id})`);
  } else {
    console.log(`✓ user (skipped, --analyze): ${email}`);
  }

  // Date range:
  // - --month=YYYY-MM => from=YYYY-MM-01, until=YYYY-MM-{31}
  // - else --from / --until (each optional, open-ended otherwise)
  let dateLo = "0000-00-00";
  let dateHi = "9999-99-99";
  if (month) {
    dateLo = `${month}-01`;
    dateHi = `${month}-31`;
    console.log(`✓ month filter: ${month}`);
  } else {
    if (from) dateLo = from;
    if (until) dateHi = until;
    console.log(`✓ date range:   ${dateLo} … ${dateHi}`);
  }

  if (types) console.log(`✓ types filter: ${[...types].sort().join(",")}`);
  if (collapseCycling) console.log("✓ --collapse-cycling: bike subtypes → CYCLING");
  if (noDaily) console.log("✓ --no-daily: skipping daily-activity files");
  console.log(`✓ dir:          ${dir}`);
  if (analyze) console.log("✓ ANALYZE — read-only, no DB calls, no parsing of daily files");
  else if (dryRun) console.log("✓ DRY RUN — no DB writes");
  console.log("");

  const allFiles = readdirSync(dir);
  const inRange = (f: string) => {
    const d = dateFromFilename(f);
    if (!d) return false;
    return d >= dateLo && d <= dateHi;
  };
  const trainingFiles = allFiles.filter(
    (f) => f.startsWith("training-session-") && f.endsWith(".json") && inRange(f)
  );
  const dailyFiles = noDaily
    ? []
    : allFiles.filter(
        (f) => f.startsWith("activity-") && f.endsWith(".json") && inRange(f)
      );

  console.log(
    `Found ${trainingFiles.length} training-session + ${dailyFiles.length} daily-activity files in range`
  );
  console.log("");

  // ── Trainings ────────────────────────────────────────────────────────────
  let tImported = 0;
  let tSkipped = 0;
  let tBlacklisted = 0;
  let tFailed = 0;
  let tFilteredType = 0;

  // Counters for analyze-summary.
  const finalTypeCount = new Map<string, number>();
  const pivot = new Map<string, number>(); // key = `${sportId}\t${device}\t${finalType}\t${decision}`

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

      const mappedType = parsed.type;
      const finalType = collapseCycling ? collapseCyclingType(mappedType) : mappedType;

      const pivotKey = (decision: string) =>
        `${parsed.sportIdRaw ?? "-"}\t${parsed.device ?? "-"}\t${finalType}\t${decision}`;

      // Type-allowlist filter.
      if (types && !types.has(finalType)) {
        if (analyze) {
          pivot.set(pivotKey("filtered-type"), (pivot.get(pivotKey("filtered-type")) ?? 0) + 1);
        }
        tFilteredType++;
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
        if (analyze) {
          pivot.set(pivotKey("mini-session"), (pivot.get(pivotKey("mini-session")) ?? 0) + 1);
        } else {
          console.log(
            `  → SKIP   ${parsed.polarId}  ${isoDate(parsed.startTime)}  (mini session: ${Math.round((parsed.durationSec ?? 0) / 60)}min / ${fmtMeters(parsed.distanceMeters)})`
          );
        }
        tSkipped++;
        continue;
      }

      if (analyze) {
        pivot.set(pivotKey("would-import"), (pivot.get(pivotKey("would-import")) ?? 0) + 1);
        finalTypeCount.set(finalType, (finalTypeCount.get(finalType) ?? 0) + 1);
        tImported++;
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
          eq(deletedPolarActivities.userId, user!.id)
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
          sex: user!.sex as Sex,
          birthday: user!.birthday,
          maxHeartRate: user!.maxHeartRate,
          restHeartRate: user!.restHeartRate,
        },
        {
          avgHeartRate: parsed.hrAvg,
          maxHeartRate: parsed.hrMax,
          duration: parsed.durationSec,
        },
        parsed.heartRateData
      );

      const fallbackTitle = `${humanizeType(finalType)} ${fmtDate(parsed.startTime)}`;
      let name = fallbackTitle;
      // Skip AI title in dry-run — wasted call, the row is never inserted.
      if (!dryRun) {
        try {
          name = await generateActivityTitle({
            type: finalType,
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
      }

      const row = {
        polarId: parsed.polarId,
        userId: user!.id,
        name,
        type: finalType,
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
          `  ✓ would insert  ${parsed.polarId}  ${isoDate(parsed.startTime)}  ${finalType}  ${fmtMeters(parsed.distanceMeters)}  trimp=${trimp ?? "-"}`
        );
      } else {
        await db.insert(activities).values(row);
        console.log(
          `  ✓ IMPORT ${parsed.polarId}  ${isoDate(parsed.startTime)}  ${finalType}  ${fmtMeters(parsed.distanceMeters)}  "${name}"`
        );
      }
      finalTypeCount.set(finalType, (finalTypeCount.get(finalType) ?? 0) + 1);
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

  // analyze mode + --no-daily both produce zero daily files anyway.
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

      if (analyze) {
        // Counted but no DB lookups.
        dImported++;
        continue;
      }

      const existing = await db.query.dailyActivity.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.userId, user!.id), eq(t.date, parsed.date)),
      });

      const values = {
        userId: user!.id,
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
  console.log(
    `Trainings         : ${tImported} ${analyze ? "would-import" : "imported"}, ${tFilteredType} type-filtered, ${tSkipped} skipped, ${tBlacklisted} blacklisted, ${tFailed} failed`
  );
  console.log(
    `Daily activities  : ${dImported} ${analyze ? "would-process" : "inserted"}, ${dUpdated} updated, ${dFailed} failed`
  );

  if (finalTypeCount.size > 0) {
    console.log("");
    console.log("Per-type counts:");
    const rows = [...finalTypeCount.entries()].sort((a, b) => b[1] - a[1]);
    for (const [type, n] of rows) {
      console.log(`  ${type.padEnd(22)} ${String(n).padStart(5)}`);
    }
  }

  if (analyze) {
    console.log("");
    console.log("Pivot (sport.id × device × final-type × decision):");
    const rows = [...pivot.entries()]
      .map(([k, n]) => {
        const [sportId, device, finalType, decision] = k.split("\t");
        return { sportId, device, finalType, decision, n };
      })
      .sort(
        (a, b) =>
          b.n - a.n ||
          a.sportId.localeCompare(b.sportId) ||
          a.device.localeCompare(b.device)
      );
    console.log(
      `  ${"sport".padEnd(6)} ${"device".padEnd(22)} ${"final-type".padEnd(20)} ${"decision".padEnd(16)} count`
    );
    for (const r of rows) {
      console.log(
        `  ${r.sportId.padEnd(6)} ${r.device.slice(0, 22).padEnd(22)} ${r.finalType.padEnd(20)} ${r.decision.padEnd(16)} ${String(r.n).padStart(5)}`
      );
    }
  }

  if (analyze) console.log("(ANALYZE — nothing was read from or written to the DB)");
  else if (dryRun) console.log("(DRY RUN — nothing was written)");
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
