/**
 * POST /api/google/webhook
 *
 * Empfänger für Benachrichtigungen der Google Health API. Bringt Aktivitäten
 * innerhalb von Sekunden nach flux, statt auf den nächsten Cron-Lauf zu warten.
 *
 * Anders als bei Polar ist der Webhook hier keine reine Beschleunigung mit
 * Verlustrisiko: Google wiederholt fehlgeschlagene Zustellungen bis zu 7 Tage
 * lang mit wachsendem Abstand. Polar hingegen quittiert und vergisst, weshalb
 * dort der Cron-Sweep die eigentliche Absicherung ist.
 *
 * Zwei Prüfungen, beide notwendig:
 *  - Authorization-Header gegen das beim Anlegen des Subscribers hinterlegte
 *    Secret. Das ist die eigentliche Zugangskontrolle.
 *  - Signatur über den rohen Body. Schützt zusätzlich davor, dass ein Leck des
 *    Secrets (Logs, Weiterleitung) sofort gefälschte Daten erlaubt.
 *
 * Beim Anlegen und Ändern eines Subscribers prüft Google die Hoheit über die
 * URL mit zwei Anfragen: eine MIT Header muss 200 liefern, eine OHNE muss 401
 * liefern. Beide tragen {"type":"verification"} im Body.
 */

import type { NextRequest } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyWebhookSignature,
  authorizationMatches,
} from "@/lib/google-webhook-signature";
import { syncGoogleActivities } from "@/lib/google-sync";
import { GoogleAuthError } from "@/lib/google-health-client";

export const runtime = "nodejs";
export const maxDuration = 300;

interface Notification {
  healthUserId?: string;
  dataType?: string;
  operation?: string;
  clientProvidedSubscriptionName?: string;
}

/** Datentypen, auf die wir reagieren. Der Rest wird nur gezählt. */
const HANDLED = new Set(["exercise", "EXERCISE"]);

export async function POST(req: NextRequest) {
  const secret = process.env.GOOGLE_HEALTH_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[google-webhook] GOOGLE_HEALTH_WEBHOOK_SECRET nicht gesetzt");
    return new Response(null, { status: 500 });
  }

  // Der rohe Text, nicht das geparste JSON: signiert wurde exakt dieses
  // Byte-für-Byte-Ergebnis. Ein Umweg über JSON.parse/stringify ändert
  // Reihenfolge und Leerzeichen und lässt die Prüfung scheitern.
  const raw = await req.text();

  if (!authorizationMatches(req.headers.get("authorization"), secret)) {
    // Muss 401 sein — Googles Verifikations-Challenge schickt absichtlich eine
    // Anfrage ohne Header und erwartet genau das. Antwortet der Endpunkt hier
    // mit 200, schlägt das Anlegen des Subscribers mit FAILED_PRECONDITION fehl.
    return new Response(null, { status: 401 });
  }

  // Verifikations-Challenge: kein signierter Payload, nur der Handschlag.
  if (isVerificationChallenge(raw)) {
    console.log("[google-webhook] Verifikations-Challenge beantwortet");
    return new Response(null, { status: 200 });
  }

  if (!(await verifyWebhookSignature(raw, req.headers.get("GOOGLE-HEALTH-API-SIGNATURE")))) {
    console.warn("[google-webhook] Signatur ungültig — verworfen");
    return new Response(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.warn("[google-webhook] Body ist kein JSON");
    return new Response(null, { status: 400 });
  }

  // Google bündelt bis zu 99 Nachrichten in einem Array.
  const notifications: Notification[] = Array.isArray(payload)
    ? (payload as Notification[])
    : [payload as Notification];

  // Sofort quittieren, Arbeit danach. Ein FIT-Download samt Titelgenerierung
  // dauert länger, als Google zu warten bereit ist.
  after(() => handle(notifications));

  return new Response(null, { status: 204 });
}

/**
 * Die Challenge kommt als {"type":"verification"}. Nur auf dieses Feld prüfen
 * und nicht auf den ganzen String, damit zusätzliche Felder oder anderes
 * Whitespace nicht dazu führen, dass wir sie für eine Benachrichtigung halten.
 */
function isVerificationChallenge(raw: string): boolean {
  try {
    const body = JSON.parse(raw);
    return !Array.isArray(body) && body?.type === "verification";
  } catch {
    return false;
  }
}

async function handle(notifications: Notification[]): Promise<void> {
  // Pro User einmal syncen, egal wie viele Nachrichten für ihn kamen — der Sync
  // holt ohnehin alles Neue im Zeitfenster.
  const userIds = new Set<string>();
  let ignored = 0;

  for (const n of notifications) {
    if (!n.dataType || !HANDLED.has(n.dataType)) {
      ignored++;
      continue;
    }
    if (!n.healthUserId) continue;
    userIds.add(n.healthUserId);
  }

  if (ignored > 0) {
    console.log(`[google-webhook] ${ignored} Nachricht(en) ohne eigenen Handler`);
  }

  for (const healthUserId of userIds) {
    const user = await db.query.users.findFirst({
      where: eq(users.googleHealthUserId, healthUserId),
    });
    if (!user) {
      // Kann passieren, wenn jemand die Verbindung getrennt hat, Google aber
      // noch nachliefert. Kein Fehler, nur nichts zu tun.
      console.warn(`[google-webhook] Kein User zu healthUserId ${healthUserId}`);
      continue;
    }
    try {
      const r = await syncGoogleActivities(user);
      console.log(
        `[google-webhook] Sync für ${user.name}: ${r.synced} neu, ${r.skipped.length} verworfen`
      );
    } catch (e) {
      if (e instanceof GoogleAuthError) {
        console.warn(`[google-webhook] Token abgelehnt user=${user.id} — neu verbinden`);
        continue;
      }
      console.error(`[google-webhook] Sync fehlgeschlagen user=${user.id}:`, e);
    }
  }
}
