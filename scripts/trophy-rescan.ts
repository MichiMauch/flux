/**
 * Trophy-Rescan für alle User.
 * Run: npx tsx scripts/trophy-rescan.ts
 *
 * Vergibt rückwirkend alle Trophies, die nach den neuen Phase-1+2-Criterion
 * matchen. Idempotent — bereits unlockte Trophies werden übersprungen.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { evaluateTrophies } = await import("../src/lib/trophies-eval");

  const userRows = await db.select({ id: users.id, name: users.name }).from(users);

  let total = 0;
  for (const u of userRows) {
    const unlocked = await evaluateTrophies(u.id);
    if (unlocked.length > 0) {
      console.log(`${u.name ?? u.id}: ${unlocked.length} neue Trophies — ${unlocked.join(", ")}`);
      total += unlocked.length;
    } else {
      console.log(`${u.name ?? u.id}: keine neuen Trophies`);
    }
  }

  console.log(`---\nGesamt: ${total} Trophies vergeben über ${userRows.length} User.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
