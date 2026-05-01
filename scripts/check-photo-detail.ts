import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const photoId = process.argv[2];
  if (!photoId) {
    console.error("Usage: npx tsx scripts/check-photo-detail.ts <photo-id>");
    process.exit(1);
  }
  const sql = postgres(url);

  const [photo] = await sql<
    {
      id: string;
      activity_id: string;
      lat: number | null;
      lng: number | null;
      taken_at: Date | null;
      location: string | null;
      width: number | null;
      height: number | null;
      created_at: Date;
    }[]
  >`SELECT * FROM activity_photos WHERE id = ${photoId}`;

  if (!photo) {
    console.log("photo not found");
    await sql.end();
    return;
  }

  console.log("PHOTO:");
  console.log(photo);

  const [activity] = await sql<
    {
      id: string;
      start_time: Date;
      duration: number | null;
      route_data: unknown;
    }[]
  >`SELECT id, start_time, duration, route_data FROM activities WHERE id = ${photo.activity_id}`;

  if (activity && photo.taken_at) {
    const route = (activity.route_data as Array<{
      lat: number;
      lng: number;
      time?: string;
    }> | null) ?? [];
    const photoMs = photo.taken_at.getTime();
    let bestDelta = Infinity;
    let bestPoint = null;
    for (const p of route) {
      if (typeof p.time !== "string") continue;
      const t = new Date(p.time).getTime();
      if (Number.isNaN(t)) continue;
      const delta = Math.abs(t - photoMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestPoint = p;
      }
    }
    console.log("\nROUTE-MATCH analysis:");
    console.log({
      activity_start: activity.start_time,
      activity_end: route.length > 0 ? route[route.length - 1].time : null,
      route_points: route.length,
      photo_time: photo.taken_at,
      best_delta_sec: Number.isFinite(bestDelta)
        ? Math.round(bestDelta / 1000)
        : null,
      best_point: bestPoint,
    });
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
