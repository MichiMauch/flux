/**
 * Backfill dailyActivity.steps from active_steps for rows where steps is null.
 * Polar's transaction-flow detail endpoint never returns total `steps`,
 * only `active-steps` — so all API-synced days had steps=null. After the
 * sync fix this only matters for days synced before the fix landed.
 *
 * Run: npx tsx scripts/backfill-daily-steps.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Lazy imports: damit dotenv VOR dem db-Modul läuft (postgres() liest
  // DATABASE_URL bei Modul-Initialisierung).
  const { db } = await import("../src/lib/db");
  const { dailyActivity } = await import("../src/lib/db/schema");
  const { sql, and, isNull, isNotNull } = await import("drizzle-orm");

  const result = await db
    .update(dailyActivity)
    .set({ steps: sql`${dailyActivity.activeSteps}` })
    .where(
      and(isNull(dailyActivity.steps), isNotNull(dailyActivity.activeSteps)),
    )
    .returning({ id: dailyActivity.id });

  console.log(`Backfilled steps from active_steps for ${result.length} rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
