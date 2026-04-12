import Database from "better-sqlite3";
import postgres from "postgres";

const BP_DB_PATH = process.argv[2] || "/Users/michaelmauch/Documents/Development/blood-pressure-tracker/data/blood-pressure.db";
const PG_URL = process.env.DATABASE_URL || "postgres://flux:flux-prod-2026@localhost:5432/flux";

interface BpSession {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timeOfDay: string;
  systolic1: number;
  diastolic1: number;
  pulse1: number;
  systolic2: number;
  diastolic2: number;
  pulse2: number;
  systolicAvg: number;
  diastolicAvg: number;
  pulseAvg: number;
  note: string | null;
}

async function main() {
  console.log("=== Blutdruck-Import ===\n");
  console.log("SQLite:", BP_DB_PATH);

  const sqlite = new Database(BP_DB_PATH, { readonly: true });
  const sql = postgres(PG_URL, { connect_timeout: 5 });

  // Get Michi's user ID
  const users = await sql`SELECT id FROM "user" WHERE email = 'michi.mauch@gmail.com'`;
  if (users.length === 0) {
    console.error("User nicht gefunden!");
    await sql.end();
    return;
  }
  const userId = users[0].id;

  // Read all BP sessions
  const sessions = sqlite.prepare("SELECT * FROM sessions ORDER BY timestamp ASC").all() as BpSession[];
  console.log(`${sessions.length} Messungen in SQLite\n`);

  let imported = 0;
  let skipped = 0;

  for (const s of sessions) {
    // Check if already imported
    const existing = await sql`SELECT id FROM blood_pressure_sessions WHERE source_id = ${s.id}`;
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO blood_pressure_sessions (id, user_id, source_id, date, time, systolic_avg, diastolic_avg, pulse_avg, note, created_at)
      VALUES (
        ${crypto.randomUUID()},
        ${userId},
        ${s.id},
        ${s.date},
        ${s.time},
        ${s.systolicAvg},
        ${s.diastolicAvg},
        ${s.pulseAvg},
        ${s.note},
        NOW()
      )
    `;
    imported++;
  }

  console.log(`✓ ${imported} importiert, ${skipped} übersprungen (bereits vorhanden)`);

  sqlite.close();
  await sql.end();
}

main().catch(console.error);
