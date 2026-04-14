import "dotenv/config";
import { db } from "../src/lib/db";
import { activities } from "../src/lib/db/schema";
import { desc, eq, isNotNull } from "drizzle-orm";

async function main() {
  const [latest] = await db
    .select()
    .from(activities)
    .where(isNotNull(activities.polarId))
    .orderBy(desc(activities.startTime))
    .limit(1);

  if (!latest) {
    console.log("No Polar activity found.");
    return;
  }

  const oldTime = latest.startTime;
  const newTime = new Date(oldTime.getTime() - 2 * 60 * 60 * 1000);

  console.log(`Activity ${latest.id} (${latest.name})`);
  console.log(`  ${oldTime.toISOString()} → ${newTime.toISOString()}`);

  await db
    .update(activities)
    .set({ startTime: newTime })
    .where(eq(activities.id, latest.id));

  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
