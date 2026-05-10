/**
 * Probe Polar's "extras" endpoints directly to see exactly what's returned —
 * including raw HTTP status — for a fresh diagnosis.
 *
 * Run: npx tsx scripts/inspect-polar-extras.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { users } = await import("../src/lib/db/schema");
  const { isNotNull } = await import("drizzle-orm");

  const userRows = await db
    .select({ id: users.id, email: users.email, polarToken: users.polarToken })
    .from(users)
    .where(isNotNull(users.polarToken));

  for (const u of userRows) {
    if (!u.polarToken) continue;
    console.log("=".repeat(72));
    console.log(`User: ${u.email}  (${u.id})`);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const probes: { label: string; url: string }[] = [
      { label: "physical-info", url: "/v3/users/physical-info" },
      { label: "cardio-load", url: "/v3/users/cardio-load" },
      {
        label: `continuous-hr/${yesterday}`,
        url: `/v3/users/continuous-heart-rate/${yesterday}`,
      },
      { label: "sleep-wise/alertness", url: "/v3/users/sleep-wise/alertness" },
      {
        label: "sleep-wise/circadian-bedtime",
        url: "/v3/users/sleep-wise/circadian-bedtime",
      },
      { label: "body-temperature", url: "/v3/users/body-temperature" },
      { label: "sleep-skin-temperature", url: "/v3/users/sleep-skin-temperature" },
      { label: "spo2", url: "/v3/users/spo2" },
      { label: "wrist-ecg", url: "/v3/users/wrist-ecg" },
      // Alternative paths to try
      { label: "skin-temperature", url: "/v3/users/skin-temperature" },
      { label: "ecg", url: "/v3/users/ecg" },
      { label: "circadian-bedtime", url: "/v3/users/circadian-bedtime" },
      { label: "alertness", url: "/v3/users/alertness" },
      { label: `today=${today} cardio-load`, url: `/v3/users/cardio-load/${today}` },
    ];

    for (const p of probes) {
      try {
        const res = await fetch(`https://www.polaraccesslink.com${p.url}`, {
          headers: {
            Authorization: `Bearer ${u.polarToken}`,
            Accept: "application/json",
          },
        });
        const text = res.status === 200 ? await res.text() : "";
        const preview = text.slice(0, 200).replace(/\s+/g, " ");
        console.log(
          `  ${p.url.padEnd(60)} ${res.status} ${preview ? preview + (text.length > 200 ? "..." : "") : ""}`,
        );
      } catch (e) {
        console.log(`  ${p.url.padEnd(60)} ERR ${e}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
