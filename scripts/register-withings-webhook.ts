/**
 * CLI to manage Withings weight notifications (appli=1) per user.
 *
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts list --user=<id>
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts subscribe --user=<id>
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts subscribe --all
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts revoke --user=<id>
 *
 * Uses NEXT_PUBLIC_BASE_URL + WITHINGS_WEBHOOK_SECRET from env (or --url to
 * override — useful to subscribe against prod from a dev shell).
 *
 *   --url=https://flux.mauch.rocks
 */

import "dotenv/config";
import { parseArgs } from "node:util";
import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import {
  listNotifications,
  refreshToken,
  revokeNotification,
  subscribeNotification,
} from "../src/lib/withings-client";

function callbackUrl(baseUrl: string, secret: string): string {
  return `${baseUrl}/api/withings/webhook?secret=${encodeURIComponent(secret)}`;
}

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

function usage(): never {
  console.error(
    "Usage:\n" +
      "  list      --user=<id>\n" +
      "  subscribe --user=<id> | --all  [--url=https://…]\n" +
      "  revoke    --user=<id>          [--url=https://…]\n"
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  if (!subcommand) usage();

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      user: { type: "string" },
      url: { type: "string" },
      all: { type: "boolean" },
    },
    strict: false,
  });

  const baseUrl = (values.url as string | undefined) ?? process.env.NEXT_PUBLIC_BASE_URL;
  const secret = process.env.WITHINGS_WEBHOOK_SECRET;
  if (!baseUrl) throw new Error("Set NEXT_PUBLIC_BASE_URL or pass --url=");
  if (!secret) throw new Error("WITHINGS_WEBHOOK_SECRET not set in env");
  if (!baseUrl.startsWith("https://")) {
    throw new Error(`Withings requires HTTPS callbacks; got ${baseUrl}`);
  }

  const targets = await pickUsers(
    values.user as string | undefined,
    Boolean(values.all)
  );
  const cb = callbackUrl(baseUrl, secret);

  for (const u of targets) {
    const label = `${u.name ?? u.id} (${u.id})`;
    try {
      const token = await getAccessToken(u);

      if (subcommand === "list") {
        const subs = await listNotifications(token, 1);
        console.log(`${label}:`, JSON.stringify(subs, null, 2));
      } else if (subcommand === "subscribe") {
        await subscribeNotification(token, cb, 1, "flux-weight");
        console.log(`${label}: subscribed → ${cb}`);
      } else if (subcommand === "revoke") {
        await revokeNotification(token, cb, 1);
        console.log(`${label}: revoked ← ${cb}`);
      } else {
        usage();
      }
    } catch (e) {
      console.error(`${label}: FAILED`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
