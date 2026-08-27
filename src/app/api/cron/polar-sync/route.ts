/**
 * POST /api/cron/polar-sync
 *
 * Backup pull that guarantees activities arrive even when a Polar webhook is
 * never delivered (deploy window, signature mismatch, Polar outage). Polar
 * acks-and-forgets failed webhooks — there is no redelivery — so without this
 * a missed EXERCISE event is lost until the user manually hits Sync.
 *
 * Called by a Coolify Scheduled Task (e.g. every 30 min).
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 *
 * Umfang: Jeder Lauf holt die Aktivitäten (ein Request pro User). Tagesdaten,
 * Schlaf und Physical Info sind um ein Vielfaches teurer und laufen nur zu den
 * Slot-Stunden aus sync-schedule.ts mit — vorher hat der Sweep damit jeden Tag
 * die Polar-App-Quote aufgebraucht und danach synct gar nichts mehr.
 *
 * Strategy: always sync EVERY connected user. syncPolarExercises is idempotent
 * (polar_id UNIQUE + deleted-blacklist), so re-checking a user with nothing new
 * is a cheap no-op. We deliberately do NOT gate on /v3/notifications: that queue
 * is acks-and-forgets like the webhook, and a lost EXERCISE notification (or a
 * lingering SLEEP/ACTIVITY_SUMMARY notification with no EXERCISE) would make a
 * filtered run skip users that actually have pending exercises — exactly the gap
 * that left activities stranded until a manual sync. With only a handful of
 * connected users a full sweep every run is trivially cheap and guarantees that
 * anything visible in /v3/exercises lands in flux within one cron interval.
 */

import type { NextRequest } from "next/server";
import { after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { PolarAuthError } from "@/lib/polar-client";
import { syncPolarExercises } from "@/lib/polar-sync";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncSleep } from "@/app/api/sync/sleep/route";
import { syncPhysicalInfo } from "@/app/api/sync/physical-info/route";
import {
  DAILY_SYNC_HOURS,
  SLEEP_SYNC_HOURS,
  isSlotDue,
} from "@/lib/sync-schedule";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const provided = match[1];
  if (provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The sweep does heavy per-exercise work (FIT download + parse, AI title,
  // reverse-geocode) for every connected user. When several activities land at
  // once this easily exceeds Cloudflare's ~100s edge timeout, which surfaces as
  // a 524 and a failed Coolify scheduled task even though the work completes.
  // Ack immediately and run the sweep in the background (maxDuration=300 keeps
  // the runtime alive after the response). The caller is a cron, not a user —
  // it only needs a 2xx; per-user outcomes are logged.
  after(runFullSweep);

  return Response.json({ accepted: true }, { status: 202 });
}

async function runFullSweep(): Promise<void> {
  try {
    // Full sweep: every connected user, every run. Idempotent + cheap.
    const toSync = await db.query.users.findMany({
      where: isNotNull(users.polarToken),
    });

    let activitiesSynced = 0;
    let usersSynced = 0;
    let reauthNeeded = 0;
    const errors: string[] = [];

    for (const user of toSync) {
      if (!user.polarToken) continue;
      try {
        const { synced } = await syncPolarExercises(user);
        activitiesSynced += synced;
        usersSynced++;

        // Daily / sleep / physical — best effort, never block the loop. Nur zu
        // den Slot-Stunden, sonst frisst der Sweep die Polar-Tagesquote auf
        // (siehe sync-schedule.ts). Der Stempel wird erst nach Erfolg gesetzt,
        // damit ein fehlgeschlagener Lauf im selben Slot nochmal drankommt.
        const now = new Date();

        if (isSlotDue(user.dailySyncedAt, DAILY_SYNC_HOURS, now)) {
          try {
            const days = await syncDailyActivity(user.id, user.polarToken);
            await db
              .update(users)
              .set({ dailySyncedAt: new Date() })
              .where(eq(users.id, user.id));
            console.log(
              `[cron/polar-sync] daily slot done user=${user.id} days=${days}`
            );
          } catch (e) {
            console.error(`[cron/polar-sync] daily failed user=${user.id}:`, e);
          }
          try {
            await syncPhysicalInfo(user.id, user.polarToken);
          } catch (e) {
            console.error(`[cron/polar-sync] physical-info failed user=${user.id}:`, e);
          }
        }

        if (isSlotDue(user.sleepSyncedAt, SLEEP_SYNC_HOURS, now)) {
          try {
            const r = await syncSleep(user.id, user.polarToken);
            await db
              .update(users)
              .set({ sleepSyncedAt: new Date() })
              .where(eq(users.id, user.id));
            console.log(
              `[cron/polar-sync] sleep slot done user=${user.id} sleep=${r.sleepSynced} nights=${r.nightsSynced}`
            );
          } catch (e) {
            console.error(`[cron/polar-sync] sleep failed user=${user.id}:`, e);
          }
        }
      } catch (e) {
        if (e instanceof PolarAuthError) {
          // Token dead — user must reconnect. Skip, don't abort the whole run.
          reauthNeeded++;
          console.warn(`[cron/polar-sync] token rejected user=${user.id} — reconnect needed`);
          continue;
        }
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`user=${user.id}: ${msg}`);
        console.error(`[cron/polar-sync] sync failed user=${user.id}:`, e);
      }
    }

    console.log(
      `[cron/polar-sync] sweep done: candidates=${toSync.length} usersSynced=${usersSynced} activitiesSynced=${activitiesSynced} reauthNeeded=${reauthNeeded} errors=${errors.length}`
    );
  } catch (err) {
    console.error("[cron/polar-sync] fatal:", err);
  }
}
