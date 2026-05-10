/**
 * Inspect what Polar v3 actually returns for inactivity_stamps on days where
 * inactivity_alert_count > 0.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { dailyActivity } = await import("../src/lib/db/schema");
  const { gt, desc } = await import("drizzle-orm");

  const rows = await db
    .select({
      date: dailyActivity.date,
      alertCount: dailyActivity.inactivityAlertCount,
      stamps: dailyActivity.inactivityStamps,
      rawV3: dailyActivity.rawV3,
    })
    .from(dailyActivity)
    .where(gt(dailyActivity.inactivityAlertCount, 0))
    .orderBy(desc(dailyActivity.date))
    .limit(3);

  for (const r of rows) {
    console.log("=".repeat(70));
    console.log(`Date: ${r.date}  alertCount: ${r.alertCount}`);
    console.log("inactivity_stamps column:", JSON.stringify(r.stamps));
    const v3 = r.rawV3 as Record<string, unknown> | null;
    if (v3) {
      console.log("v3.inactivity_stamps (top):", JSON.stringify(v3["inactivity_stamps"]));
      const samples = v3["samples"] as Record<string, unknown> | undefined;
      console.log(
        "v3.samples keys:",
        samples ? Object.keys(samples) : "no samples",
      );
      if (samples) {
        console.log(
          "v3.samples.inactivity_stamps:",
          JSON.stringify(samples["inactivity_stamps"]),
        );
      }
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
