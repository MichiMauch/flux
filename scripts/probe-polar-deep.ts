/**
 * Try every plausible path variant for the Polar AccessLink endpoints we
 * couldn't reach. Includes user-id-prefixed paths, query-param variants,
 * date-suffixed paths, and host alternatives.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { isNotNull } = await import("drizzle-orm");

  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      polarToken: users.polarToken,
      polarUserId: users.polarUserId,
    })
    .from(users)
    .where(isNotNull(users.polarToken));

  for (const u of userRows) {
    if (!u.polarToken || !u.polarUserId) continue;
    console.log("=".repeat(80));
    console.log(`User: ${u.email}  polarUserId=${u.polarUserId}`);

    const today = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const bases = ["https://www.polaraccesslink.com"];
    const paths: string[] = [
      // Body / skin temperature
      "/v3/users/body-temperature",
      `/v3/users/${u.polarUserId}/body-temperature`,
      `/v3/users/body-temperature?from=${week}&to=${today}`,
      `/v3/users/body-temperature/${today}`,
      "/v3/users/sleep-skin-temperature",
      `/v3/users/${u.polarUserId}/sleep-skin-temperature`,
      `/v3/users/sleep-skin-temperature?from=${week}&to=${today}`,
      `/v3/users/sleep-skin-temperature/${today}`,
      "/v3/users/skin-temperature",
      // SpO2
      "/v3/users/spo2",
      `/v3/users/${u.polarUserId}/spo2`,
      `/v3/users/spo2?from=${week}&to=${today}`,
      "/v3/users/spo2-test-results",
      "/v3/users/spo2/results",
      // Wrist ECG
      "/v3/users/wrist-ecg",
      `/v3/users/${u.polarUserId}/wrist-ecg`,
      `/v3/users/wrist-ecg?from=${week}&to=${today}`,
      "/v3/users/ecg",
      "/v3/users/ecg-test-results",
      // Sleep-wise
      "/v3/users/sleep-wise/alertness",
      `/v3/users/${u.polarUserId}/sleep-wise/alertness`,
      `/v3/users/sleep-wise/alertness?from=${week}&to=${today}`,
      "/v3/users/sleepwise/alertness",
      "/v3/users/sleep-wise/circadian-bedtime",
      `/v3/users/${u.polarUserId}/sleep-wise/circadian-bedtime`,
      `/v3/users/sleep-wise/circadian-bedtime?from=${week}&to=${today}`,
      "/v3/users/sleepwise/circadian-bedtime",
      // V3 daily activity with extra query params just to be sure
      `/v3/users/activities/${today}?body_temperature=true&spo2=true`,
      // Skin contacts (debug data per docs)
      "/v3/users/skin-contacts",
      `/v3/users/${u.polarUserId}/skin-contacts`,
    ];

    for (const path of paths) {
      try {
        const res = await fetch(`${bases[0]}${path}`, {
          headers: {
            Authorization: `Bearer ${u.polarToken}`,
            Accept: "application/json",
          },
        });
        const body = res.status === 200 ? await res.text() : "";
        const preview = body.slice(0, 220).replace(/\s+/g, " ");
        console.log(
          `  ${String(res.status).padEnd(4)} ${path.padEnd(74)} ${preview}`,
        );
      } catch (e) {
        console.log(`  ERR  ${path.padEnd(74)} ${e}`);
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
