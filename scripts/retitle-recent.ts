/**
 * Re-generate AI activity titles for all users from a given start date, using
 * OSM landmarks (see src/lib/landmarks.ts). Safe: only overwrites a title when
 * named landmarks are actually found, so it never degrades a good title to a
 * bare settlement name on an Overpass miss. Dry-run by default.
 *
 *   npx tsx scripts/retitle-recent.ts                 # dry-run, since 2026-07-05
 *   npx tsx scripts/retitle-recent.ts --since=2026-07-01
 *   npx tsx scripts/retitle-recent.ts --apply         # write changes
 *
 * Loads .env.local explicitly (dotenv/config would only read .env). Needs the
 * SSH tunnel to the prod DB (scripts/dev.sh).
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
// Skip activities whose title already is a landmark chain ("A–B–C"); only
// (re)title still-generic ones. Protects good titles from LLM variance on reruns
// and lets you retry gaps left by a flaky network.
const ONLY_GENERIC = process.argv.includes("--only-generic");
const sinceArg = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1];
const SINCE = new Date(`${sinceArg ?? "2026-07-05"}T00:00:00Z`);
// Be gentle on the public Overpass instance between activities.
const DELAY_MS = 2500;

async function main() {
  const { db } = await import("../src/lib/db");
  const { activities } = await import("../src/lib/db/schema");
  const { gte, eq } = await import("drizzle-orm");
  const { generateActivityTitle, normalizePolarType } = await import("../src/lib/ai-title");
  const { findRouteLandmarks, findEndpointPois } = await import("../src/lib/landmarks");

  // Metadata only (no route_data) — keep the payload small over the tunnel.
  const meta = await db
    .select({
      id: activities.id, name: activities.name, type: activities.type,
      startTime: activities.startTime, distance: activities.distance,
      ascent: activities.ascent, duration: activities.duration, movingTime: activities.movingTime,
    })
    .from(activities)
    .where(gte(activities.startTime, SINCE));
  meta.sort((a, b) => +a.startTime - +b.startTime);
  console.log(`${meta.length} Aktivität(en) ab ${SINCE.toISOString().slice(0, 10)}  (APPLY=${APPLY})\n`);

  let changed = 0, skipped = 0;
  for (const a of meta) {
    const [full] = await db.select({ routeData: activities.routeData })
      .from(activities).where(eq(activities.id, a.id));
    const route = (full?.routeData as { lat: number; lng: number }[] | null) ?? [];
    const date = a.startTime.toISOString().slice(0, 10);

    if (ONLY_GENERIC && a.name.includes("–")) {
      console.log(`${date}  "${a.name}"  (schon Landmark-Kette, übersprungen)`);
      continue;
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
    // Safety: only rewrite when we actually found a named feature — either a
    // route-wide landmark (peak/hut/pass) OR a destination POI at an endpoint
    // (hut/hotel/lake/pass). Without either, skip so we never degrade a good
    // title to a bare settlement name on an Overpass miss.
    const clean = route.filter((p) => p.lat != null && p.lng != null);
    const [lm, pois] = await Promise.all([
      findRouteLandmarks(route),
      clean.length >= 2
        ? findEndpointPois(clean[0], clean[clean.length - 1])
        : Promise.resolve({ start: null, end: null }),
    ]);
    if (lm.length === 0 && !pois.start && !pois.end) {
      skipped++;
      console.log(`${date}  "${a.name}"  — keine Landmarks/POIs (übersprungen)`);
      continue;
    }
    const neu = await generateActivityTitle({
      type: normalizePolarType(a.type, a.name), subType: a.name,
      startTime: a.startTime, distanceMeters: a.distance,
      durationSeconds: a.duration ?? a.movingTime, ascentMeters: a.ascent,
      routeData: route, fallbackTitle: a.name, landmarks: lm,
    });
    if (neu && neu !== a.name) {
      changed++;
      console.log(`${date}  "${a.name}"  →  "${neu}"   [${lm.map((l) => l.name).join(", ")}]`);
      if (APPLY) await db.update(activities).set({ name: neu }).where(eq(activities.id, a.id));
    } else {
      console.log(`${date}  "${a.name}"  (unverändert)`);
    }
  }
  console.log(`\n${changed} ${APPLY ? "geändert (geschrieben)" : "würden geändert"}, ${skipped} ohne Landmarks übersprungen.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FEHLER:", e?.cause?.code || e?.code || "", e?.cause?.message || e?.message || e);
  process.exit(1);
});
