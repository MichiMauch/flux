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
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { PolarAuthError } from "@/lib/polar-client";
import { syncPolarExercises } from "@/lib/polar-sync";
import { syncDailyActivity } from "@/app/api/sync/daily/route";
import { syncSleep } from "@/app/api/sync/sleep/route";
import { syncPhysicalInfo } from "@/app/api/sync/physical-info/route";

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

        // Daily / sleep / physical — best effort, never block the loop.
        try {
          await syncDailyActivity(user.id, user.polarToken);
        } catch (e) {
          console.error(`[cron/polar-sync] daily failed user=${user.id}:`, e);
        }
        try {
          await syncSleep(user.id, user.polarToken);
        } catch (e) {
          console.error(`[cron/polar-sync] sleep failed user=${user.id}:`, e);
        }
        try {
          await syncPhysicalInfo(user.id, user.polarToken);
        } catch (e) {
          console.error(`[cron/polar-sync] physical-info failed user=${user.id}:`, e);
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

    return Response.json({
      candidates: toSync.length,
      usersSynced,
      activitiesSynced,
      reauthNeeded,
      errors,
    });
  } catch (err) {
    console.error("[cron/polar-sync] fatal:", err);
    return Response.json(
      {
        error: "Cron run failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
