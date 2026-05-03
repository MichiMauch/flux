/**
 * Backfill locality + country (ISO-2) für bestehende Activities.
 * Run: npx tsx scripts/backfill-locality.ts
 *
 * Liest activities mit geocoded_at IS NULL und nutzt routeData[0],
 * um Mapbox reverseGeocodeStructured() zu rufen. Throttled mit kurzem
 * Sleep zwischen Calls (Mapbox Rate-Limit ~600/min für free tier).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db";
import { activities } from "../src/lib/db/schema";
import { isNull, eq } from "drizzle-orm";
import { reverseGeocodeStructured } from "../src/lib/geocode";

const SLEEP_MS = 150; // ~6 req/s, well under Mapbox limit

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const rows = await db
    .select({
      id: activities.id,
      routeData: activities.routeData,
    })
    .from(activities)
    .where(isNull(activities.geocodedAt));

  let updated = 0;
  let noRoute = 0;
  let geocodeFailed = 0;

  for (const row of rows) {
    const route = row.routeData as { lat: number; lng: number }[] | null;
    const start = route?.[0];
    if (!start || typeof start.lat !== "number" || typeof start.lng !== "number") {
      noRoute++;
      continue;
    }

    const loc = await reverseGeocodeStructured(start.lat, start.lng);
    if (!loc) {
      geocodeFailed++;
      await sleep(SLEEP_MS);
      continue;
    }

    await db
      .update(activities)
      .set({
        locality: loc.locality,
        country: loc.country,
        geocodedAt: new Date(),
      })
      .where(eq(activities.id, row.id));
    updated++;

    if (updated % 25 === 0) {
      console.log(
        `… ${updated} updated, ${noRoute} ohne Route, ${geocodeFailed} Geocode-Fails`
      );
    }
    await sleep(SLEEP_MS);
  }

  console.log(
    `Backfill done. updated=${updated} noRoute=${noRoute} failed=${geocodeFailed} total=${rows.length}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
