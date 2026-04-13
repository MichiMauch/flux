import postgres from "postgres";

async function main() {
  const sql = postgres("postgresql://polar:polar@localhost:5432/polar_self_connect");

  const rows = await sql`SELECT polar_token, polar_user_id FROM "user" WHERE email = 'michi.mauch@gmail.com'`;
  const token = rows[0]?.polar_token;
  const userId = rows[0]?.polar_user_id;

  console.log("Token length:", token?.length);
  console.log("Polar User ID:", userId);

  if (!token) {
    console.log("No token found!");
    await sql.end();
    return;
  }

  // Try registering user WITH member-id
  console.log("\n--- Registering user (with member-id) ---");
  const regRes = await fetch("https://www.polaraccesslink.com/v3/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ "member-id": `user_${userId}` }),
  });
  console.log("Status:", regRes.status);
  const regText = await regRes.text();
  console.log("Response:", regText);

  // Try listing exercises after registration
  console.log("\n--- Listing exercises ---");
  const exRes = await fetch("https://www.polaraccesslink.com/v3/exercises", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  console.log("Status:", exRes.status);
  const exText = await exRes.text();
  console.log("Response:", exText.slice(0, 1000));

  await sql.end();
}

main().catch(console.error);
