const postgres = require("postgres");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

async function seed() {
  const sql = postgres(process.env.DATABASE_URL);

  // Check if users already exist
  const existing = await sql`SELECT count(*) as c FROM "user"`;
  if (parseInt(existing[0].c) > 0) {
    console.log("Users already exist, skipping seed.");
    await sql.end();
    return;
  }

  const password1 = await bcrypt.hash("changeme", 12);
  const password2 = await bcrypt.hash("changeme", 12);

  await sql`
    INSERT INTO "user" (id, name, email, password, created_at)
    VALUES
      (${crypto.randomUUID()}, 'Michi', 'michi.mauch@gmail.com', ${password1}, NOW()),
      (${crypto.randomUUID()}, 'Sibylle', 'sibylle.koelliker@gmail.com', ${password2}, NOW())
    ON CONFLICT (email) DO NOTHING
  `;

  console.log("Seed complete: 2 users created.");
  await sql.end();
}

seed().catch(console.error);
