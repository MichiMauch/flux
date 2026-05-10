import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { isNotNull } = await import("drizzle-orm");

  const userRows = await db
    .select({ email: users.email, polarToken: users.polarToken })
    .from(users)
    .where(isNotNull(users.polarToken));

  for (const u of userRows) {
    if (!u.polarToken) continue;
    console.log("=".repeat(72));
    console.log(`User: ${u.email}`);

    const paths = [
      "/v3/users/biosensing/bodytemperature",
      "/v3/users/biosensing/skintemperature",
      "/v3/users/biosensing/skincontacts",
      "/v3/users/biosensing/ecg",
      "/v3/users/biosensing/spo2",
      "/v3/users/sleepwise/alertness/date",
      "/v3/users/sleepwise/circadian-bedtime/date",
      "/v3/users/cardio-load/period/days/28",
    ];

    for (const p of paths) {
      const res = await fetch(`https://www.polaraccesslink.com${p}`, {
        headers: {
          Authorization: `Bearer ${u.polarToken}`,
          Accept: "application/json",
        },
      });
      const body = res.status === 200 ? await res.text() : "";
      console.log(
        `  ${String(res.status).padEnd(4)} ${p.padEnd(60)} ${body.slice(0, 220).replace(/\s+/g, " ")}`,
      );
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
