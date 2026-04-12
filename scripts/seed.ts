import postgres from "postgres";
import bcrypt from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://polar:polar@localhost:5432/polar_self_connect";

async function seed() {
  const sql = postgres(DATABASE_URL);

  const password1 = await bcrypt.hash("changeme", 12);
  const password2 = await bcrypt.hash("changeme", 12);

  await sql`
    INSERT INTO "user" (id, name, email, password, "createdAt")
    VALUES
      (${crypto.randomUUID()}, 'Michael', 'michael@example.com', ${password1}, NOW()),
      (${crypto.randomUUID()}, 'Partner', 'partner@example.com', ${password2}, NOW())
    ON CONFLICT (email) DO NOTHING
  `;

  console.log("Seed complete: 2 users created.");
  console.log("  michael@example.com / changeme");
  console.log("  partner@example.com / changeme");
  console.log("");
  console.log("Change passwords and emails in this script before first use!");

  await sql.end();
}

seed().catch(console.error);
