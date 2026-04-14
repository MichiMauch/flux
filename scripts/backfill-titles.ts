/**
 * Backfill AI-generated titles for existing activities with generic names.
 * Run: npx tsx scripts/backfill-titles.ts
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { activities } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  generateActivityTitle,
  isGenericTitle,
  normalizePolarType,
} from "../src/lib/ai-title";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const all = await db.select().from(activities);
  let processed = 0;
  let skipped = 0;
  let updated = 0;
  let failed = 0;

  for (const a of all) {
    processed++;
    if (!isGenericTitle(a.name, a.type)) {
      skipped++;
      continue;
    }

    // Normalize: if type is OTHER but name hints at a known sport, use name as type.
    const normalizedType = normalizePolarType(a.type, a.name);
    const typeChanged = normalizedType !== a.type;

    const fallback = a.name;
    try {
      const newTitle = await generateActivityTitle({
        type: normalizedType,
        subType: a.name,
        startTime: a.startTime,
        distanceMeters: a.distance,
        durationSeconds: a.duration ?? a.movingTime,
        ascentMeters: a.ascent,
        routeData: (a.routeData as { lat: number; lng: number; time?: string }[] | null) ?? null,
        fallbackTitle: fallback,
      });
      const updates: { name?: string; type?: string } = {};
      if (newTitle && newTitle !== fallback) updates.name = newTitle;
      if (typeChanged) updates.type = normalizedType;

      if (Object.keys(updates).length > 0) {
        await db.update(activities).set(updates).where(eq(activities.id, a.id));
        updated++;
        console.log(
          `[${processed}/${all.length}] ${fallback} (${a.type}) → ${updates.name ?? fallback} (${updates.type ?? a.type})`
        );
      } else {
        skipped++;
      }
    } catch (e) {
      failed++;
      console.warn(`[${processed}/${all.length}] Failed for ${a.id}:`, e);
    }
    await sleep(300);
  }

  console.log(`\nDone. processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
