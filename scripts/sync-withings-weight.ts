/**
 * CLI to pull recent Withings weight measurements for a user (or all users
 * with a Withings connection) and insert any new ones into the DB. Refreshes
 * the access token automatically if expired.
 *
 *   tsx --env-file=.env.local scripts/sync-withings-weight.ts --user=<id>
 *   tsx --env-file=.env.local scripts/sync-withings-weight.ts --all
 *   tsx --env-file=.env.local scripts/sync-withings-weight.ts --user=<id> --days=30
 *
 * Useful as a one-off backfill when a webhook didn't fire (e.g. for users who
 * connected Withings before the webhook auto-subscribe code was deployed).
 */

import "dotenv/config";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db";
import { users, weightMeasurements } from "../src/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import {
  getWeightMeasurements,
  refreshToken,
} from "../src/lib/withings-client";

async function getAccessToken(
  user: typeof users.$inferSelect
): Promise<string> {
  if (!user.withingsAccessToken || !user.withingsRefreshToken) {
    throw new Error(`User ${user.id} has no Withings tokens`);
  }
  if (user.withingsTokenExpiry && user.withingsTokenExpiry < new Date()) {
    const refreshed = await refreshToken(user.withingsRefreshToken);
    await db
      .update(users)
      .set({
        withingsAccessToken: refreshed.access_token,
        withingsRefreshToken: refreshed.refresh_token,
        withingsTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
      })
      .where(eq(users.id, user.id));
    return refreshed.access_token;
  }
  return user.withingsAccessToken;
}

async function pickUsers(userId: string | undefined, all: boolean) {
  if (all) {
    return db.query.users.findMany({
      where: isNotNull(users.withingsAccessToken),
    });
  }
  if (!userId) throw new Error("Pass --user=<id> or --all");
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) throw new Error(`User ${userId} not found`);
  return [u];
}

async function syncUser(
  user: typeof users.$inferSelect,
  days: number
): Promise<{ synced: number; total: number }> {
  const accessToken = await getAccessToken(user);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const measurements = await getWeightMeasurements(accessToken, startDate);
  let synced = 0;

  for (const m of measurements) {
    if (!m.weight) continue;
    const existing = await db.query.weightMeasurements.findFirst({
      where: eq(weightMeasurements.withingsId, String(m.id)),
    });
    if (existing) continue;

    await db.insert(weightMeasurements).values({
      userId: user.id,
      withingsId: String(m.id),
      date: m.date,
      weight: m.weight,
      fatMass: m.fatMass ?? null,
      muscleMass: m.muscleMass ?? null,
      bmi: m.bmi ?? null,
    });
    synced++;
  }

  return { synced, total: measurements.length };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      user: { type: "string" },
      all: { type: "boolean" },
      days: { type: "string" },
    },
    strict: false,
  });

  const days = values.days ? Number(values.days) : 30;
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`--days must be a positive number, got ${values.days}`);
  }

  const targets = await pickUsers(
    values.user as string | undefined,
    Boolean(values.all)
  );

  for (const u of targets) {
    const label = `${u.name ?? u.id} (${u.id})`;
    try {
      const { synced, total } = await syncUser(u, days);
      console.log(`${label}: ${synced} new / ${total} total (last ${days}d)`);
    } catch (e) {
      console.error(`${label}: FAILED`, e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
