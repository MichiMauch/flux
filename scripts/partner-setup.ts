import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const action = process.argv[2] ?? "list";

  if (action === "list") {
    const rows = await sql`
      SELECT id, name, email, partner_id, partner_push_enabled
      FROM "user" ORDER BY email
    `;
    console.log(JSON.stringify(rows, null, 2));
  } else if (action === "link") {
    const a = process.argv[3];
    const b = process.argv[4];
    if (!a || !b) {
      console.error("Usage: partner-setup.ts link <userIdA> <userIdB>");
      process.exit(1);
    }
    await sql.begin(async (tx) => {
      await tx`UPDATE "user" SET partner_id = ${b} WHERE id = ${a}`;
      await tx`UPDATE "user" SET partner_id = ${a} WHERE id = ${b}`;
    });
    const rows = await sql`
      SELECT id, name, email, partner_id, partner_push_enabled
      FROM "user" WHERE id IN (${a}, ${b})
    `;
    console.log("Updated:");
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.error(`Unknown action: ${action}`);
    process.exit(1);
  }

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
