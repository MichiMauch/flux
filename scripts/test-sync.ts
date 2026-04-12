import postgres from "postgres";

async function main() {
  const dbUrl = process.env.DATABASE_URL || "postgres://flux:flux-prod-2026@localhost:5432/flux";
  const sql = postgres(dbUrl, { connect_timeout: 5 });

  console.log("=== Polar Sync Test ===\n");

  // 1. DB-Verbindung
  try {
    const result = await sql`SELECT 1 as ok`;
    console.log("✓ DB-Verbindung OK");
  } catch (e) {
    console.error("✗ DB-Verbindung fehlgeschlagen:", String(e));
    await sql.end();
    process.exit(1);
  }

  // 2. User mit Polar-Token prüfen
  const users = await sql`SELECT id, name, email, polar_user_id, polar_token FROM "user"`;
  console.log(`✓ ${users.length} User in der DB\n`);

  for (const user of users) {
    console.log(`── ${user.name} (${user.email}) ──`);

    if (!user.polar_token) {
      console.log("  ⚠ Kein Polar-Token → nicht verbunden\n");
      continue;
    }
    console.log(`  ✓ Polar verbunden (User ID: ${user.polar_user_id})`);

    // 3. Polar API abfragen
    try {
      const res = await fetch("https://www.polaraccesslink.com/v3/exercises", {
        headers: {
          Authorization: `Bearer ${user.polar_token}`,
          Accept: "application/json",
        },
      });

      if (res.status === 204) {
        console.log("  ✓ Polar API erreichbar — keine neuen Exercises");
      } else if (res.ok) {
        const exercises = await res.json();
        console.log(`  ✓ Polar API erreichbar — ${exercises.length} Exercise(s) verfügbar`);

        for (const ex of exercises) {
          const existing = await sql`SELECT id FROM activities WHERE polar_id = ${ex.id}`;
          const status = existing.length > 0 ? "bereits gesynct" : "NEU";
          const date = new Date(ex.start_time).toLocaleDateString("de-CH");
          const sport = ex.detailed_sport_info || ex.sport || "?";
          const dist = ex.distance ? `${(ex.distance / 1000).toFixed(1)} km` : "–";
          console.log(`    ${status === "NEU" ? "→" : "✓"} [${status}] ${date} ${sport} (${dist})`);
        }
      } else {
        console.log(`  ✗ Polar API Fehler: ${res.status}`);
      }
    } catch (e) {
      console.error(`  ✗ Polar API nicht erreichbar:`, String(e));
    }

    // 4. Aktivitäten in DB
    const activities = await sql`
      SELECT name, type, start_time, distance
      FROM activities
      WHERE user_id = ${user.id}
      ORDER BY start_time DESC
      LIMIT 5
    `;
    console.log(`  ✓ ${activities.length} Aktivität(en) in DB:`);
    for (const a of activities) {
      const date = new Date(a.start_time).toLocaleDateString("de-CH");
      const dist = a.distance ? `${(a.distance / 1000).toFixed(1)} km` : "–";
      console.log(`    • ${date} ${a.name} (${dist})`);
    }
    console.log();
  }

  // 5. Webhook-Status
  const clientId = process.env.POLAR_CLIENT_ID || "";
  const clientSecret = process.env.POLAR_CLIENT_SECRET || "";
  if (clientId && clientSecret) {
    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://www.polaraccesslink.com/v3/webhooks", {
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const webhook = await res.json();
        const data = webhook.data;
        if (data) {
          console.log(`── Webhook ──`);
          console.log(`  URL: ${data.url}`);
          console.log(`  Events: ${data.events?.join(", ")}`);
          console.log(`  Aktiv: ${data.active ? "✓ Ja" : "✗ Nein"}`);
        }
      }
    } catch (e) {
      console.log("  ⚠ Webhook-Status konnte nicht geprüft werden");
    }
  }

  console.log("\n=== Test abgeschlossen ===");
  await sql.end();
}

main().catch(console.error);
