/**
 * CLI to manage the Polar AccessLink webhook for this application.
 *
 * Polar allows exactly one webhook per application. To change its URL or
 * subscribed events you need to delete the existing one and create a new one.
 *
 *   tsx --env-file=.env.local scripts/register-polar-webhook.ts list
 *   tsx --env-file=.env.local scripts/register-polar-webhook.ts create \
 *     --url=https://<your-domain>/api/polar/webhook \
 *     [--events=EXERCISE,ACTIVITY_SUMMARY,SLEEP]
 *   tsx --env-file=.env.local scripts/register-polar-webhook.ts delete --id=<webhook-id>
 *
 * The `create` response includes a `signature_secret_key` — copy it into
 * POLAR_WEBHOOK_SECRET in .env.local so webhook signatures are validated.
 */

import { parseArgs } from "node:util";

const POLAR_API_BASE = "https://www.polaraccesslink.com";
const DEFAULT_EVENTS = ["EXERCISE", "ACTIVITY_SUMMARY", "SLEEP"];

function basicAuth(): string {
  const id = process.env.POLAR_CLIENT_ID;
  const secret = process.env.POLAR_CLIENT_SECRET;
  if (!id || !secret) {
    console.error("Missing POLAR_CLIENT_ID or POLAR_CLIENT_SECRET in env.");
    process.exit(1);
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function listWebhooks(): Promise<void> {
  const res = await fetch(`${POLAR_API_BASE}/v3/webhooks`, {
    headers: { Authorization: basicAuth(), Accept: "application/json" },
  });
  const text = await res.text();
  console.log(`[${res.status}]`, text || "(empty)");
}

async function createWebhook(url: string, events: string[]): Promise<void> {
  const res = await fetch(`${POLAR_API_BASE}/v3/webhooks`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ events, url }),
  });
  const text = await res.text();
  console.log(`[${res.status}]`, text);
  if (res.ok) {
    console.log("\nAdd the signature_secret_key to .env.local:");
    console.log("  POLAR_WEBHOOK_SECRET=<signature_secret_key>\n");
  }
}

async function deleteWebhook(id: string): Promise<void> {
  const res = await fetch(`${POLAR_API_BASE}/v3/webhooks/${id}`, {
    method: "DELETE",
    headers: { Authorization: basicAuth(), Accept: "application/json" },
  });
  console.log(`[${res.status}] ${res.ok ? "deleted" : await res.text()}`);
}

function usage(): never {
  console.error(
    "Usage:\n" +
      "  tsx --env-file=.env.local scripts/register-polar-webhook.ts list\n" +
      "  tsx --env-file=.env.local scripts/register-polar-webhook.ts create --url=<url> [--events=EVENT1,EVENT2]\n" +
      "  tsx --env-file=.env.local scripts/register-polar-webhook.ts delete --id=<webhook-id>\n"
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const subcommand = process.argv[2];
  if (!subcommand) usage();

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      url: { type: "string" },
      events: { type: "string" },
      id: { type: "string" },
    },
    strict: false,
  });

  if (subcommand === "list") {
    await listWebhooks();
  } else if (subcommand === "create") {
    if (!values.url) usage();
    const events = values.events
      ? String(values.events).split(",").map((s) => s.trim()).filter(Boolean)
      : DEFAULT_EVENTS;
    await createWebhook(String(values.url), events);
  } else if (subcommand === "delete") {
    if (!values.id) usage();
    await deleteWebhook(String(values.id));
  } else {
    usage();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
