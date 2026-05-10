/**
 * Backfill Polar v3 daily activity data (inactivity stamps, alert count,
 * inactive duration, daily-activity goal %, step samples, zone samples) for
 * existing daily_activity rows.
 *
 * Polar's v3 endpoint accepts dates up to 365 days back. Older rows stay
 * without v3 data — that's fine.
 *
 * Run: npx tsx scripts/backfill-daily-v3.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const SLEEP_MS = 250; // be polite to Polar API

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { dailyActivity, users } = await import("../src/lib/db/schema");
  const { eq, isNull, and, gte } = await import("drizzle-orm");
  const { getDailyActivityV3, parseIsoDuration } = await import(
    "../src/lib/polar-client"
  );

  // Polar v3 limit: 365 days back
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 365);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: dailyActivity.id,
      userId: dailyActivity.userId,
      date: dailyActivity.date,
      polarToken: users.polarToken,
    })
    .from(dailyActivity)
    .innerJoin(users, eq(users.id, dailyActivity.userId))
    .where(
      and(
        isNull(dailyActivity.rawV3),
        gte(dailyActivity.date, cutoffIso),
      ),
    );

  console.log(`Found ${rows.length} rows to enrich (within 365 days)`);

  let ok = 0;
  let empty = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.polarToken) {
      failed++;
      continue;
    }
    try {
      const v3 = await getDailyActivityV3(row.polarToken, row.date, {
        inactivityStamps: true,
        activityZones: true,
        steps: true,
      });
      if (!v3) {
        empty++;
      } else {
        // Polar v3 wraps stamps as { samples: [...] } despite docs.
        const v3Stamps = v3.samples?.inactivity_stamps;
        const v3StampsArray = Array.isArray(v3Stamps)
          ? v3Stamps
          : v3Stamps?.samples ?? null;
        await db
          .update(dailyActivity)
          .set({
            rawV3: v3,
            inactivityAlertCount:
              typeof v3.inactivity_alert_count === "number"
                ? v3.inactivity_alert_count
                : null,
            inactiveDurationSec: parseIsoDuration(v3.inactive_duration),
            inactivityStamps: v3StampsArray ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(dailyActivity.id, row.id));
        ok++;
      }
      console.log(
        `  ${row.date}  ${v3 ? "✓ enriched" : "· empty"}  alerts=${
          v3?.inactivity_alert_count ?? "-"
        }`,
      );
    } catch (e) {
      failed++;
      console.warn(`  ${row.date}  ✗ failed: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(`\nDone. enriched=${ok}  empty=${empty}  failed=${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
