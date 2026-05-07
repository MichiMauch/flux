import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import postgres from "postgres";

const STATEMENTS = [
  `CREATE INDEX IF NOT EXISTS "activities_user_start_idx" ON "activities" USING btree ("user_id","start_time")`,
  `CREATE INDEX IF NOT EXISTS "activities_user_type_start_idx" ON "activities" USING btree ("user_id","type","start_time")`,
  `CREATE INDEX IF NOT EXISTS "activity_photos_activity_idx" ON "activity_photos" USING btree ("activity_id")`,
  `CREATE INDEX IF NOT EXISTS "blood_pressure_sessions_user_measured_idx" ON "blood_pressure_sessions" USING btree ("user_id","measured_at")`,
  `CREATE INDEX IF NOT EXISTS "daily_activity_user_date_idx" ON "daily_activity" USING btree ("user_id","date")`,
  `CREATE INDEX IF NOT EXISTS "goals_user_active_idx" ON "goals" USING btree ("user_id","active")`,
  `CREATE INDEX IF NOT EXISTS "nightly_recharge_user_date_idx" ON "nightly_recharge" USING btree ("user_id","date")`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at")`,
  `CREATE INDEX IF NOT EXISTS "sleep_sessions_user_date_idx" ON "sleep_sessions" USING btree ("user_id","date")`,
  `CREATE INDEX IF NOT EXISTS "weight_measurements_user_date_idx" ON "weight_measurements" USING btree ("user_id","date")`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    for (const stmt of STATEMENTS) {
      const t0 = Date.now();
      await sql.unsafe(stmt);
      console.log(`✓ ${(Date.now() - t0)}ms — ${stmt.match(/"([^"]+_idx)"/)?.[1]}`);
    }
    console.log("\nAll indexes ensured.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main();
