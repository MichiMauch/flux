import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
const sqlText = readFileSync('drizzle/0023_flimsy_lily_hollister.sql', 'utf8');
const statements = sqlText
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

const sql = postgres(url, { connect_timeout: 10 });
try {
  await sql.begin(async (tx) => {
    for (const stmt of statements) {
      console.log('  ', stmt.slice(0, 100));
      await tx.unsafe(stmt);
    }
  });
  console.log('Done.');
} catch (e) {
  console.error('ERR:', e.message, e.code);
  process.exit(1);
} finally {
  await sql.end();
}
