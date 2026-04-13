/**
 * Backfill TRIMP for existing activities.
 * Run: npx tsx scripts/backfill-trimp.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { activities, users } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeTrimp, type Sex } from "../src/lib/trimp";

async function main() {
  const rows = await db
    .select()
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id));

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const a = row.activities;
    const u = row.user;

    const hr = (a.heartRateData as { time: string; bpm: number }[] | null) ?? null;

    const trimp = computeTrimp(
      {
        sex: u.sex as Sex,
        birthday: u.birthday,
        maxHeartRate: u.maxHeartRate,
        restHeartRate: u.restHeartRate,
      },
      {
        avgHeartRate: a.avgHeartRate,
        maxHeartRate: a.maxHeartRate,
        duration: a.duration,
      },
      hr
    );

    if (trimp == null) {
      skipped++;
      continue;
    }

    await db.update(activities).set({ trimp }).where(eq(activities.id, a.id));
    updated++;
  }

  console.log(`Backfill done. updated=${updated} skipped=${skipped} total=${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
