/**
 * CLI to import Strava activities into flux.
 *
 *   tsx --env-file=.env.local scripts/import-strava.ts \
 *     --month=YYYY-MM \
 *     --email=<user-email> \
 *     [--dry-run] [--yes]
 *
 * Fetches via Strava REST v3 using STRAVA_REFRESH_TOKEN from .env.local.
 * For each activity: skips strong duplicates of existing rows (time ±5 min +
 * distance ±10%), prompts interactively for weak duplicates on the same date,
 * applies the same ≥5 min / ≥500 m min-session filter as the Polar import.
 *
 * Inserts with polarId = "strava:<id>" (reusing the existing unique
 * constraint on activities.polar_id for idempotency across both sources).
 */

import { parseArgs } from "node:util";
import * as readline from "node:readline/promises";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "../src/lib/db";
import { users, activities } from "../src/lib/db/schema";
import { fetchActivitiesInRange, fetchStreams, type StravaActivity } from "../src/lib/strava-client";
import { parseStravaActivity, type ParsedStravaActivity } from "../src/lib/strava-import-parser";
import { computeTrimp, type Sex } from "../src/lib/trimp";
import { generateActivityTitle } from "../src/lib/ai-title";
import { buildRouteGeometry } from "../src/lib/activities/route-geometry";

interface Args {
  month: string;
  email: string;
  dryRun: boolean;
  yes: boolean;
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    options: {
      month: { type: "string" },
      email: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
    },
  });
  const month = values.month;
  const email = values.email;
  if (!month || !email) {
    console.error(
      "Usage: tsx --env-file=.env.local scripts/import-strava.ts \\\n" +
        "  --month=YYYY-MM --email=<email> [--dry-run] [--yes]"
    );
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    console.error(`Invalid --month=${month}, expected YYYY-MM`);
    process.exit(1);
  }
  return {
    month,
    email,
    dryRun: !!values["dry-run"],
    yes: !!values.yes,
  };
}

function monthBounds(month: string): { afterUnix: number; beforeUnix: number } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  // Strava's `after` is exclusive, so subtract 1 second to include first-of-month activities.
  return {
    afterUnix: Math.floor(start.getTime() / 1000) - 1,
    beforeUnix: Math.floor(end.getTime() / 1000),
  };
}

async function main() {
  const { month, email, dryRun, yes } = parseCliArgs();

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exit(1);
  }
  console.log(`✓ user resolved: ${user.email} (${user.id})`);
  console.log(`✓ month filter:  ${month}`);
  if (dryRun) console.log("✓ DRY RUN — no DB writes, no prompts");
  if (yes) console.log("✓ --yes — weak duplicates will be imported without prompt");
  console.log("");

  const { afterUnix, beforeUnix } = monthBounds(month);
  console.log(`Fetching Strava activities in [${new Date(afterUnix * 1000).toISOString()}, ${new Date(beforeUnix * 1000).toISOString()})…`);
  const stravaList = await fetchActivitiesInRange(afterUnix, beforeUnix);
  console.log(`Received ${stravaList.length} activities from Strava`);
  console.log("");

  const hasTty = Boolean(process.stdin.isTTY);
  if (!dryRun && !yes && !hasTty) {
    console.error(
      "ERROR: stdin is not a TTY and --yes was not passed.\n" +
        "  Weak-match prompts cannot be answered. Re-run in a real terminal,\n" +
        "  or add --yes to auto-accept same-day matches."
    );
    process.exit(2);
  }
  const rl = dryRun || yes || !hasTty
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  let globalYes = yes;

  let imported = 0;
  let skippedStrong = 0;
  let skippedWeak = 0;
  let skippedMini = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (const activity of stravaList) {
    const summary = `${activity.sport_type.padEnd(18)} ${fmtMeters(activity.distance).padStart(10)}  ${activity.start_date_local}  "${activity.name}"`;

    // Idempotency: have we imported this Strava id before?
    const existing = await db.query.activities.findFirst({
      where: eq(activities.polarId, `strava:${activity.id}`),
    });
    if (existing) {
      console.log(`  → SKIP   strava:${activity.id}  ${summary}  (already imported)`);
      skippedExisting++;
      continue;
    }

    // Min-session filter
    const MIN_DURATION_SEC = 300;
    const MIN_DISTANCE_M = 500;
    const durSec = activity.moving_time ?? 0;
    const distM = activity.distance ?? 0;
    if (durSec < MIN_DURATION_SEC || distM < MIN_DISTANCE_M) {
      console.log(
        `  → SKIP   strava:${activity.id}  ${summary}  (mini: ${Math.round(durSec / 60)}min / ${fmtMeters(distM)})`
      );
      skippedMini++;
      continue;
    }

    // Dedup against existing activities (same day)
    const startLocal = activity.start_date_local.slice(0, 10); // YYYY-MM-DD
    const candidates = await findSameDayCandidates(
      user.id,
      new Date(activity.start_date),
      startLocal
    );
    const strong = candidates.find((c) => isStrongMatch(activity, c));
    if (strong) {
      console.log(
        `  → SKIP   strava:${activity.id}  ${summary}  (strong-dup of ${strong.polarId ?? strong.id})`
      );
      skippedStrong++;
      continue;
    }
    if (candidates.length > 0 && !globalYes) {
      if (dryRun) {
        console.log(`  ? PROMPT strava:${activity.id}  ${summary}  — would prompt (${candidates.length} same-day candidate${candidates.length > 1 ? "s" : ""})`);
      } else if (rl) {
        printComparison(activity, candidates);
        const answer = (await rl.question("    Import Strava anyway? [y/N/a=all-yes] ")).trim().toLowerCase();
        if (answer === "a") {
          globalYes = true;
        } else if (answer !== "y") {
          console.log(`    → SKIP   strava:${activity.id}  (user declined)`);
          skippedWeak++;
          continue;
        }
      }
    }

    // Fetch streams + parse
    let parsed: ParsedStravaActivity;
    try {
      const streams = await fetchStreams(activity.id);
      parsed = parseStravaActivity(activity, streams);
    } catch (e) {
      console.error(`  ✗ ERROR strava:${activity.id} streams/parse: ${errMsg(e)}`);
      failed++;
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

    const fallbackTitle =
      parsed.rawName && parsed.rawName.trim().length > 0
        ? parsed.rawName.trim()
        : `${humanizeType(parsed.type)} ${fmtDate(parsed.startTime)}`;
    let name = fallbackTitle;
    try {
      name = await generateActivityTitle({
        type: parsed.type,
        subType: null,
        startTime: parsed.startTime,
        distanceMeters: parsed.distanceMeters,
        durationSeconds: parsed.movingTimeSec || parsed.durationSec,
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
      movingTime: parsed.movingTimeSec,
      distance: parsed.distanceMeters,
      calories: parsed.calories,
      avgHeartRate: parsed.hrAvg,
      maxHeartRate: parsed.hrMax,
      ascent: parsed.ascent,
      descent: parsed.descent,
      routeData: parsed.routeData,
      routeGeometry: buildRouteGeometry(parsed.routeData),
      heartRateData: parsed.heartRateData,
      speedData: parsed.speedData,
      minAltitude: parsed.minAltitude,
      maxAltitude: parsed.maxAltitude,
      avgSpeed: parsed.avgSpeed,
      maxSpeed: parsed.maxSpeed,
      trimp,
      device: parsed.device,
    };

    if (dryRun) {
      console.log(
        `  ✓ would insert  strava:${activity.id}  ${isoDate(parsed.startTime)}  ${parsed.type}  ${fmtMeters(parsed.distanceMeters)}  trimp=${trimp ?? "-"}`
      );
    } else {
      await db.insert(activities).values(row);
      console.log(
        `  ✓ IMPORT ${parsed.polarId}  ${isoDate(parsed.startTime)}  ${parsed.type}  ${fmtMeters(parsed.distanceMeters)}  "${name}"`
      );
    }
    imported++;
  }

  rl?.close();

  console.log("");
  console.log("════════════════════════════════════════");
  console.log(`Strava fetched    : ${stravaList.length}`);
  console.log(`Imported          : ${imported}`);
  console.log(`Skipped existing  : ${skippedExisting}`);
  console.log(`Skipped strong    : ${skippedStrong}   (time+distance match to non-strava row)`);
  console.log(`Skipped weak      : ${skippedWeak}     (user declined prompt)`);
  console.log(`Skipped mini      : ${skippedMini}`);
  console.log(`Failed            : ${failed}`);
  if (dryRun) console.log("(DRY RUN — nothing was written)");
  console.log("════════════════════════════════════════");
}

// ── Dedup helpers ────────────────────────────────────────────────────────────

type Candidate = {
  id: string;
  polarId: string | null;
  name: string;
  type: string;
  startTime: Date;
  duration: number | null;
  distance: number | null;
  ascent: number | null;
};

async function findSameDayCandidates(
  userId: string,
  stravaStartUtc: Date,
  stravaStartLocalDate: string
): Promise<Candidate[]> {
  // Pre-filter in SQL with a generous ±36h window around the local date,
  // then narrow down to strict local-calendar-day match in JS.
  const base = new Date(stravaStartLocalDate + "T00:00:00Z");
  const from = new Date(base.getTime() - 36 * 3600 * 1000);
  const to = new Date(base.getTime() + 60 * 3600 * 1000);

  const rows = await db
    .select({
      id: activities.id,
      polarId: activities.polarId,
      name: activities.name,
      type: activities.type,
      startTime: activities.startTime,
      duration: activities.duration,
      distance: activities.distance,
      ascent: activities.ascent,
    })
    .from(activities)
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, from),
        lt(activities.startTime, to)
      )
    );

  return rows.filter((r) => localDateInZurich(r.startTime) === stravaStartLocalDate);
}

function localDateInZurich(d: Date): string {
  // en-CA → YYYY-MM-DD
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" });
}

function isStrongMatch(stravaA: StravaActivity, c: Candidate): boolean {
  const stravaStart = new Date(stravaA.start_date).getTime();
  const diffMin = Math.abs(stravaStart - c.startTime.getTime()) / 60_000;
  if (diffMin > 5) return false;
  if (c.distance == null || stravaA.distance == null) return false;
  if (c.distance <= 0) return false;
  const ratio = Math.abs(stravaA.distance - c.distance) / c.distance;
  return ratio <= 0.10;
}

function printComparison(stravaA: StravaActivity, candidates: Candidate[]) {
  const dt = stravaA.start_date_local.replace("T", " ").slice(0, 16);
  console.log(
    `  ⚠ Same-date candidate(s) for Strava ${stravaA.id} (${dt}):`
  );
  console.log(
    `      Strava:    ${padType(stravaA.sport_type)}  ${fmtMeters(stravaA.distance).padStart(9)}  ${fmtDur(stravaA.moving_time).padStart(6)}  ${fmtAscent(stravaA.total_elevation_gain).padStart(7)}`
  );
  for (const c of candidates) {
    const origin = c.polarId ?? "?";
    console.log(
      `      Existing:  ${padType(c.type)}  ${fmtMeters(c.distance).padStart(9)}  ${fmtDur(c.duration).padStart(6)}  ${fmtAscent(c.ascent).padStart(7)}   (${origin})`
    );
  }
}

// ── Small formatting helpers ─────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtMeters(m: number | null | undefined): string {
  if (m == null) return "-";
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}
function fmtDur(sec: number | null | undefined): string {
  if (sec == null) return "-";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
}
function fmtAscent(m: number | null | undefined): string {
  if (m == null) return "-";
  return `${Math.round(m)} m ↑`;
}
function padType(t: string): string {
  return t.padEnd(18).slice(0, 18);
}
function humanizeType(t: string): string {
  const map: Record<string, string> = {
    RUNNING: "Lauf",
    CYCLING: "Radtour",
    ROAD_BIKING: "Rennrad",
    MOUNTAIN_BIKING: "MTB",
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
