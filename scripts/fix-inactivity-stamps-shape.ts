/**
 * One-shot fix: unwrap inactivity_stamps from {samples: [...]} to [...].
 * Polar v3 returns the wrapper object even though docs claim a flat array.
 * Earlier backfill stored the wrapper. This flattens it.
 *
 * Run: npx tsx scripts/fix-inactivity-stamps-shape.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { dailyActivity } = await import("../src/lib/db/schema");
  const { isNotNull, eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      id: dailyActivity.id,
      stamps: dailyActivity.inactivityStamps,
    })
    .from(dailyActivity)
    .where(isNotNull(dailyActivity.inactivityStamps));

  let fixed = 0;
  for (const r of rows) {
    const stamps = r.stamps;
    if (
      stamps &&
      typeof stamps === "object" &&
      !Array.isArray(stamps) &&
      "samples" in stamps
    ) {
      const inner = (stamps as { samples?: unknown }).samples;
      if (Array.isArray(inner)) {
        await db
          .update(dailyActivity)
          .set({ inactivityStamps: inner })
          .where(eq(dailyActivity.id, r.id));
        fixed++;
      }
    }
  }
  console.log(`Flattened ${fixed} rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
