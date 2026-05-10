/**
 * Re-fetch each Polar exercise to populate muscle_load, running_index, and
 * any other training_load_pro fields that weren't pulled before.
 *
 * Run: npx tsx scripts/backfill-activity-load.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const SLEEP_MS = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { db } = await import("../src/lib/db");
  const { activities, users } = await import("../src/lib/db/schema");
  const { eq, isNotNull, and, isNull } = await import("drizzle-orm");
  const { getExercise } = await import("../src/lib/polar-client");

  const rows = await db
    .select({
      id: activities.id,
      polarId: activities.polarId,
      userId: activities.userId,
      polarToken: users.polarToken,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(
      and(
        isNotNull(activities.polarId),
        isNotNull(users.polarToken),
        isNull(activities.muscleLoad),
      ),
    );

  console.log(`Backfilling ${rows.length} activities`);

  let muscleSet = 0;
  let runIdxSet = 0;
  let failed = 0;

  for (const r of rows) {
    if (!r.polarToken || !r.polarId) continue;
    try {
      const ex = (await getExercise(r.polarToken, r.polarId)) as unknown as Record<
        string,
        unknown
      >;
      const tlp = ex.training_load_pro as Record<string, unknown> | undefined;
      const muscleLoad =
        typeof tlp?.["muscle-load"] === "number"
          ? (tlp["muscle-load"] as number)
          : null;
      const muscleInterp =
        typeof tlp?.["muscle-load-interpretation"] === "string"
          ? (tlp["muscle-load-interpretation"] as string)
          : null;
      const runIdx =
        typeof ex["running-index"] === "number"
          ? (ex["running-index"] as number)
          : null;

      const updates: Record<string, unknown> = {};
      if (muscleLoad != null) {
        updates.muscleLoad = muscleLoad;
        updates.muscleLoadInterpretation = muscleInterp;
        muscleSet++;
      }
      if (runIdx != null) {
        updates.runningIndex = runIdx;
        runIdxSet++;
      }
      if (Object.keys(updates).length > 0) {
        await db.update(activities).set(updates).where(eq(activities.id, r.id));
      }
    } catch (e) {
      failed++;
      console.warn(`  ${r.polarId}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(SLEEP_MS);
  }

  console.log(
    `\nDone. muscleLoad=${muscleSet}  runningIndex=${runIdxSet}  failed=${failed}`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
