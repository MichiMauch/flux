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
 * Strategy: ask /v3/notifications which users have pending data (one app-level
 * call). If that succeeds, only sync those users — cheap. If it fails for any
 * reason, fall back to syncing every connected user so a broken notifications
 * endpoint can never silently disable the backup.
 */

import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { listNotifications, PolarAuthError } from "@/lib/polar-client";
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
    const connected = await db.query.users.findMany({
      where: isNotNull(users.polarToken),
    });

    // Optional efficiency filter: only sync users Polar says have pending data.
    // Any failure → sync everyone (safe default; correctness over cost).
    let targetIds: Set<string> | null = null;
    try {
      const pending = await listNotifications();
      if (pending.length > 0) {
        const pendingPolarIds = new Set(
          pending
            .filter((n) => n["data-type"] === "EXERCISE")
            .map((n) => String(n["user-id"]))
        );
        targetIds = new Set(
          connected
            .filter((u) => u.polarUserId && pendingPolarIds.has(u.polarUserId))
            .map((u) => u.id)
        );
      } else {
        // Endpoint reachable, nothing pending — still fall through to a full
        // sweep below as a cheap safety net (idempotent no-ops).
        targetIds = null;
      }
    } catch (e) {
      console.warn("[cron/polar-sync] notifications unavailable, syncing all:", e);
      targetIds = null;
    }

    const toSync = targetIds
      ? connected.filter((u) => targetIds!.has(u.id))
      : connected;

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
      filtered: targetIds !== null,
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
