/**
 * CLI to manage Withings weight notifications (appli=1) per user.
 *
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts list --user=<id>
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts subscribe --user=<id>
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts subscribe --all
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts revoke --user=<id>
 *   tsx --env-file=.env.local scripts/register-withings-webhook.ts revoke --user=<id> --callback-url=https://...
 *
 * Uses NEXT_PUBLIC_BASE_URL from env (or --url to override — useful to
 * subscribe against prod from a dev shell). The webhook URL is per-user
 * and contains a random token stored on the user row; if the row has no
 * token yet, one is generated on subscribe.
 *
 *   --url=https://flux.mauch.rocks
 *
 * Pass --callback-url to revoke an arbitrary subscription (useful to clean
 * up stale entries from before the URL scheme was migrated, since those
 * URLs aren't reconstructible from the user row).
 */

import "dotenv/config";
import { randomUUID } from "crypto";
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

function webhookUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/api/withings/webhook/${token}`;
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
      "callback-url": { type: "string" },
    },
    strict: false,
  });

  const callbackUrlOverride = values["callback-url"] as string | undefined;

  const baseUrl = (values.url as string | undefined) ?? process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) throw new Error("Set NEXT_PUBLIC_BASE_URL or pass --url=");
  if (!baseUrl.startsWith("https://")) {
    throw new Error(`Withings requires HTTPS callbacks; got ${baseUrl}`);
  }

  const targets = await pickUsers(
    values.user as string | undefined,
    Boolean(values.all)
  );

  for (const u of targets) {
    const label = `${u.name ?? u.id} (${u.id})`;
    try {
      const accessToken = await getAccessToken(u);

      // Per-user webhook token. Generate one if missing (only when actually
      // subscribing — list/revoke operate on the existing token).
      let webhookToken = u.withingsWebhookToken;
      if (!webhookToken && subcommand === "subscribe") {
        webhookToken = randomUUID();
        await db
          .update(users)
          .set({ withingsWebhookToken: webhookToken })
          .where(eq(users.id, u.id));
      }
      // For revoke we may target an arbitrary URL via --callback-url (e.g. a
      // stale subscription from before the URL scheme migration). For
      // subscribe we always derive from the user's webhook_token.
      if (
        !webhookToken &&
        subcommand !== "list" &&
        !(subcommand === "revoke" && callbackUrlOverride)
      ) {
        console.error(`${label}: no withings_webhook_token on user — skip`);
        continue;
      }
      const cb = webhookToken ? webhookUrl(baseUrl, webhookToken) : null;

      if (subcommand === "list") {
        const subs = await listNotifications(accessToken, 1);
        console.log(`${label}:`, JSON.stringify(subs, null, 2));
      } else if (subcommand === "subscribe" && cb) {
        await subscribeNotification(accessToken, cb, 1, "flux-weight");
        console.log(`${label}: subscribed`);
      } else if (subcommand === "revoke") {
        const target = callbackUrlOverride ?? cb;
        if (!target) {
          console.error(`${label}: no callback URL to revoke`);
          continue;
        }
        await revokeNotification(accessToken, target, 1);
        console.log(`${label}: revoked ${target}`);
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
