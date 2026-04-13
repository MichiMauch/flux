import postgres from "postgres";

const sql = postgres(
  process.env.DATABASE_URL || "postgres://flux:flux-prod-2026@localhost:5432/flux"
);

async function main() {
  const rows = await sql<{ id: string; date: string; time: string | null }[]>`
    SELECT id, date, time FROM blood_pressure_sessions WHERE measured_at IS NULL
  `;
  console.log(`Backfilling ${rows.length} entries...`);

  let updated = 0;
  for (const r of rows) {
    // date is DD.MM.YYYY, time is HH:MM
    const [dd, mm, yyyy] = r.date.split(".");
    const time = r.time || "00:00";
    if (!dd || !mm || !yyyy) {
      console.warn("Skipping invalid date:", r.date);
      continue;
    }
    // ISO format: YYYY-MM-DDTHH:MM
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${time}:00`;
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) {
      console.warn("Invalid date:", r.date, r.time);
      continue;
    }
    await sql`UPDATE blood_pressure_sessions SET measured_at = ${dt} WHERE id = ${r.id}`;
    updated++;
  }
  console.log(`✓ Updated ${updated} entries`);
  await sql.end();
}

main().catch(console.error);
