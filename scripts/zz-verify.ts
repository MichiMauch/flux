import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const r = await sql<{ ohne: string; mit: string }[]>`
    SELECT count(*) FILTER (WHERE data_type='timestamp without time zone') AS ohne,
           count(*) FILTER (WHERE data_type='timestamp with time zone')    AS mit
    FROM information_schema.columns WHERE table_schema='public' AND data_type LIKE 'timestamp%'`;
  console.log(`timestamptz: ${r[0].mit}   ohne TZ: ${r[0].ohne}`);
  const m = await sql`SELECT count(*) AS n FROM drizzle.__drizzle_migrations`;
  console.log("angewendete Migrationen:", m[0].n, "(vorher 34)");
  await sql.end();
  process.exit(0);
}
main();
