/**
 * Verwaltet den Webhook-Empfaenger ("Subscriber") der Google Health API.
 *
 *   tsx --env-file=.env.local scripts/register-google-webhook.ts list
 *   tsx --env-file=.env.local scripts/register-google-webhook.ts create \
 *     --url=https://flux.mauch.rocks/api/google/webhook
 *   tsx --env-file=.env.local scripts/register-google-webhook.ts delete --id=flux
 *
 * Die Subscriber-Verwaltung laeuft NICHT ueber den OAuth-Token des Nutzers,
 * sondern ueber ein Google-Cloud-Zugriffstoken mit cloud-platform-Scope. Am
 * einfachsten:
 *
 *   gcloud auth application-default login
 *   export GOOGLE_HEALTH_ADMIN_TOKEN=$(gcloud auth application-default print-access-token)
 *
 * Ausserdem braucht die API die Projekt-NUMMER, nicht die Projekt-ID:
 *
 *   gcloud projects describe flux-health-507906 --format='value(projectNumber)'
 *
 * Beim Anlegen prueft Google sofort die Hoheit ueber die URL: eine Anfrage MIT
 * dem hinterlegten Secret muss 200 liefern, eine OHNE muss 401 liefern. Der
 * Endpunkt muss also bereits deployt sein, sonst scheitert das Anlegen mit
 * FAILED_PRECONDITION.
 */

import { parseArgs } from "node:util";

const API = "https://health.googleapis.com/v4";

/** Datentypen, auf die flux hoert. Aktivitaeten heute, Schlaf und Schritte spaeter. */
const DEFAULT_DATA_TYPES = ["exercise"];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} fehlt.`);
    if (name === "GOOGLE_HEALTH_ADMIN_TOKEN") {
      console.error("  export GOOGLE_HEALTH_ADMIN_TOKEN=$(gcloud auth application-default print-access-token)");
    }
    if (name === "GOOGLE_HEALTH_PROJECT_NUMBER") {
      console.error("  gcloud projects describe flux-health-507906 --format='value(projectNumber)'");
    }
    process.exit(1);
  }
  return v;
}

async function call(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireEnv("GOOGLE_HEALTH_ADMIN_TOKEN")}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, text: await res.text() };
}

function projectPath(): string {
  return `/projects/${requireEnv("GOOGLE_HEALTH_PROJECT_NUMBER")}/subscribers`;
}

function print(label: string, r: { status: number; text: string }) {
  console.log(`\n${label} — HTTP ${r.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(r.text), null, 2));
  } catch {
    console.log(r.text || "(leer)");
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: "string" },
      id: { type: "string", default: "flux" },
      "data-types": { type: "string" },
    },
  });
  const command = positionals[0];

  if (command === "list") {
    print("Subscriber", await call("GET", projectPath()));
    return;
  }

  if (command === "create") {
    if (!values.url) throw new Error("--url fehlt");
    if (!values.url.startsWith("https://")) {
      throw new Error("Die URL muss https sein — Google akzeptiert nichts anderes");
    }
    const secret = requireEnv("GOOGLE_HEALTH_WEBHOOK_SECRET");
    const dataTypes = values["data-types"]?.split(",") ?? DEFAULT_DATA_TYPES;

    console.log(`Lege Subscriber "${values.id}" an`);
    console.log(`  URL        : ${values.url}`);
    console.log(`  Datentypen : ${dataTypes.join(", ")}`);
    console.log("  Google prueft die URL jetzt sofort mit zwei Anfragen.");

    print(
      "Anlegen",
      await call("POST", `${projectPath()}?subscriberId=${encodeURIComponent(values.id!)}`, {
        endpointUri: values.url,
        subscriberConfigs: [{ dataTypes, subscriptionCreatePolicy: "AUTOMATIC" }],
        endpointAuthorization: { secret },
      })
    );
    return;
  }

  if (command === "delete") {
    print("Loeschen", await call("DELETE", `${projectPath()}/${encodeURIComponent(values.id!)}`));
    return;
  }

  console.error("Befehl fehlt: list | create | delete");
  process.exit(1);
}

main().catch((e) => {
  console.error("Abbruch:", e instanceof Error ? e.message : e);
  process.exit(1);
});
