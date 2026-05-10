/**
 * Refetch ONLY cardio-load data from Polar. Use when the previous backfill
 * lost cardio-load to a 429. Hits /v3/users/cardio-load once per user
 * (returns the last ~28 days), then writes the per-day fields into
 * daily_polar_extras. Skips other columns to avoid clobbering anything.
 *
 * Run: npx tsx scripts/backfill-cardio-load-only.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { dailyPolarExtras, users } = await import("../src/lib/db/schema");
  const { isNotNull, eq, and } = await import("drizzle-orm");
  const { listCardioLoad } = await import("../src/lib/polar-client");

  const userRows = await db
    .select({ id: users.id, polarToken: users.polarToken })
    .from(users)
    .where(isNotNull(users.polarToken));

  for (const u of userRows) {
    if (!u.polarToken) continue;
    let list: Array<Record<string, unknown>>;
    try {
      list = (await listCardioLoad(u.polarToken)) as Array<
        Record<string, unknown>
      >;
    } catch (e) {
      console.warn(`user=${u.id}: cardio-load failed (${e}). Skipping.`);
      continue;
    }
    if (!Array.isArray(list)) {
      console.log(`user=${u.id}: no cardio-load data`);
      continue;
    }
    console.log(`user=${u.id}: ${list.length} cardio-load entries`);

    let updated = 0;
    let inserted = 0;
    for (const cl of list) {
      const date = typeof cl.date === "string" ? (cl.date as string) : null;
      if (!date) continue;
      const existing = await db
        .select({ id: dailyPolarExtras.id })
        .from(dailyPolarExtras)
        .where(
          and(
            eq(dailyPolarExtras.userId, u.id),
            eq(dailyPolarExtras.date, date),
          ),
        )
        .limit(1);
      const values = {
        cardioLoad:
          typeof cl.cardio_load === "number"
            ? (cl.cardio_load as number)
            : null,
        cardioLoadStatus:
          typeof cl.cardio_load_status === "string"
            ? (cl.cardio_load_status as string)
            : null,
        cardioLoadStrain:
          typeof cl.strain === "number" ? (cl.strain as number) : null,
        cardioLoadTolerance:
          typeof cl.tolerance === "number" ? (cl.tolerance as number) : null,
        cardioLoadRatio:
          typeof cl.cardio_load_ratio === "number"
            ? (cl.cardio_load_ratio as number)
            : null,
        cardioLoadLevel: cl.cardio_load_level ?? null,
        cardioLoadRaw: cl,
        updatedAt: new Date(),
      };
      if (existing.length > 0) {
        await db
          .update(dailyPolarExtras)
          .set(values)
          .where(eq(dailyPolarExtras.id, existing[0].id));
        updated++;
      } else {
        await db
          .insert(dailyPolarExtras)
          .values({ ...values, userId: u.id, date });
        inserted++;
      }
    }
    console.log(`  updated=${updated} inserted=${inserted}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
