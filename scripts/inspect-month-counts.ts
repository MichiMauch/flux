import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const rows = await sql`
    SELECT u.name AS user_name,
           to_char(a.start_time, 'YYYY-MM') AS month,
           COUNT(*) AS cnt
    FROM activities a
    LEFT JOIN "user" u ON u.id = a.user_id
    GROUP BY u.name, to_char(a.start_time, 'YYYY-MM')
    ORDER BY u.name, month DESC
    LIMIT 30
  `;
  for (const r of rows) console.log(r);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
